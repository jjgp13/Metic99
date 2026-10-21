-- =============================================================================
-- Metic99 leaderboard: what an Endless score was played with (run AFTER
-- story-boards.sql)
-- =============================================================================
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Apply it BEFORE deploying a game build that shows ship / power / time on
-- the Endless board. (A new build against an old database still submits:
-- it retries without the details. Its board just shows no details.)
--
-- Each Endless score gets ONE detail row in `endless_runs`, keyed by the
-- score's own id (one-to-one): the ship, the power, the world (theme) and
-- how long the run lasted. `scores` stays the one ranking table for every
-- board; each mode keeps its own context in its own table (a story stage or
-- a battle would get theirs).
--
-- The write path is still only submit_run. It gains four optional
-- parameters (default null), so the game already deployed keeps submitting
-- exactly as before: no details, no detail row.
--
-- Everything is in one transaction: if any step fails, nothing changes.
-- =============================================================================

begin;

-- 1) The detail table. --------------------------------------------------------
--    The id lists below are copies of the game's own lists: adding a ship,
--    a power or a world means updating its check here too.
--      ships:  RENDER3D.SHIPS (src/config/tuning/render3d.ts)
--      powers: POWER_KINDS (src/config/tuning/powers.ts)
--      worlds: "notebook" + each LevelDef.PAGE (src/config/worlds.ts)
create table if not exists public.endless_runs (
  score_id    bigint primary key references public.scores (id) on delete cascade,
  ship        text not null,
  power       text not null,
  theme       text not null,
  survival_ms int  not null,
  constraint endless_runs_ship_chk
    check (ship in ('ship_player', 'ship_dart', 'ship_pod')),
  constraint endless_runs_power_chk
    check (power in ('freeze', 'slow', 'blast', 'shield')),
  constraint endless_runs_theme_chk
    check (theme in ('notebook', 'backyard', 'pond', 'treetops', 'swamp', 'cave',
                     'volcano', 'sky', 'snow', 'night', 'bedroom')),
  -- A match ticket lasts 4 hours, so no run can be longer.
  constraint endless_runs_survival_chk
    check (survival_ms between 0 and 4 * 3600 * 1000)
);

-- Public read like `scores` (the board shows it), no writes from the API:
-- only submit_run (security definer) inserts.
alter table public.endless_runs enable row level security;
drop policy if exists "public read" on public.endless_runs;
create policy "public read" on public.endless_runs
  for select to anon, authenticated using (true);
revoke all on public.endless_runs from anon, authenticated;
grant select on public.endless_runs to anon, authenticated;

-- 2) submit_run(..., ship, power, theme, survival): as before, plus the
--    details of an Endless run. Dropped and recreated (not overloaded): two
--    versions with defaults would make PostgREST's call ambiguous.
drop function if exists public.submit_run(uuid, text, int, int);

create or replace function public.submit_run(
  p_match       uuid,
  p_name        text,
  p_score       int,
  p_level       int  default 0,
  p_ship        text default null,
  p_power       text default null,
  p_theme       text default null,
  p_survival_ms int  default null
)
returns table (row_id bigint, rank int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issued  timestamptz;
  v_elapsed numeric;
  v_cap     int;
  v_id      bigint;
  v_details boolean;
begin
  if p_name !~ '^[A-Z0-9]{3,6}$' then
    raise exception 'invalid name';
  end if;
  if p_score is null or p_score < 0 or p_score > public.board_score_cap(p_level) then
    raise exception 'invalid score';
  end if;

  -- Details come all together or not at all (an old client sends none),
  -- and only for Endless.
  v_details := p_ship is not null or p_power is not null
            or p_theme is not null or p_survival_ms is not null;
  if v_details and (p_ship is null or p_power is null
                    or p_theme is null or p_survival_ms is null) then
    raise exception 'incomplete run details';
  end if;
  if v_details and p_level <> 0 then
    raise exception 'run details are for Endless only';
  end if;

  -- Consume the ticket only if it is unused, in its age window, and was
  -- issued for THIS board (an Endless ticket can't post to a stage board).
  update public.matches
     set used = true
   where id = p_match
     and level = p_level
     and used = false
     and issued_at <= now() - interval '2 seconds'
     and issued_at >= now() - interval '4 hours'
   returning issued_at into v_issued;

  if v_issued is null then
    raise exception 'invalid or expired match';
  end if;

  -- Plausibility: the same generous points-per-second cap as before.
  v_elapsed := extract(epoch from (now() - v_issued));
  v_cap := least(public.board_score_cap(p_level), ceil(v_elapsed * 3000) + 5000);
  if p_score > v_cap then
    raise exception 'implausible score for elapsed time';
  end if;

  if v_details then
    -- The run's own clock stops while paused, so it can't be longer than
    -- the ticket's age. 5 s of slack: the ticket is issued a moment after
    -- the run's clock starts (the request's trip to the server).
    if p_survival_ms > v_elapsed * 1000 + 5000 then
      raise exception 'survival longer than the match';
    end if;
    -- The same points-per-second cap, on the time actually played.
    if p_score > ceil(p_survival_ms / 1000.0 * 3000) + 5000 then
      raise exception 'implausible score for survival time';
    end if;
  end if;

  insert into public.scores (name, score, level)
  values (p_name, p_score, p_level)
  returning id into v_id;

  -- A bad ship / power / theme fails its check here, which rolls the whole
  -- call back: the score row and the used ticket are undone too.
  if v_details then
    insert into public.endless_runs (score_id, ship, power, theme, survival_ms)
    values (v_id, p_ship, p_power, p_theme, p_survival_ms);
  end if;

  return query
    select v_id,
           (select count(*)::int + 1
              from public.scores s
             where s.level = p_level and s.score > p_score);
end;
$$;

-- 3) The browser (anon) may call only this. ------------------------------------
revoke all on function public.submit_run(uuid, text, int, int, text, text, text, int) from public;
grant execute on function public.submit_run(uuid, text, int, int, text, text, text, int) to anon, authenticated;

commit;
