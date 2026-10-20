-- =============================================================================
-- Metic99 leaderboard: one board per story stage (run AFTER match-gate.sql)
-- =============================================================================
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Apply it BEFORE deploying a game build that has the story map: the new
-- client reads `scores.level`.
--
-- Every score now says which board it is on, in a `level` column:
--   0      = Endless (every row that exists today becomes level 0)
--   1..10  = story stage N (the points scored in that stage)
--   99     = a whole story run (the run's total)
-- (src/config/tuning/storage.ts: LEADERBOARD.ENDLESS_BOARD / STORY_RUN_BOARD.)
--
-- The write path is still the match gate: a match ticket is issued FOR one
-- board, and submit_run only accepts a ticket on the board it was issued for.
-- The functions keep their old call shapes (p_level defaults to 0), so a game
-- already deployed keeps submitting Endless scores while this runs.
--
-- Everything is in one transaction: if any step fails, nothing changes.
-- =============================================================================

begin;

-- 0) An old 1-5 character name check was still on the live table next to
--    scores_name_chk (3-6): together they refused 6-letter initials.
alter table public.scores drop constraint if exists name_format;

-- 1) The board column on scores, plus an index for "top N on a board". -------
alter table public.scores add column if not exists level smallint not null default 0;

alter table public.scores drop constraint if exists scores_level_chk;
alter table public.scores
  add constraint scores_level_chk check (level between 0 and 99);

create index if not exists scores_level_score_idx
  on public.scores (level, score desc, created_at);

-- 2) Match tickets remember their board. ---------------------------------------
alter table public.matches add column if not exists level smallint not null default 0;

-- 3) Score caps per board (on top of the per-second cap in submit_run). --------
--    A story stage is a few minutes long (an ace bot scores ~40k on stage 1),
--    so 300k is far above real play but stops absurd forgeries. Endless and a
--    whole run keep the table's 1,000,000 limit.
create or replace function public.board_score_cap(p_level int)
returns int
language sql
immutable
set search_path = public
as $$
  select case when p_level between 1 and 10 then 300000 else 1000000 end;
$$;

-- 4) start_match(p_level): a ticket for one board. -----------------------------
--    Dropped and recreated (not overloaded): two versions with defaults would
--    make PostgREST's call `start_match()` ambiguous.
drop function if exists public.start_match();

create or replace function public.start_match(p_level int default 0)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_level is null or p_level < 0 or p_level > 99 then
    raise exception 'invalid board';
  end if;

  -- Opportunistic cleanup so the table never grows unbounded.
  delete from public.matches where issued_at < now() - interval '1 day';

  insert into public.matches (level) values (p_level) returning id into v_id;
  return v_id;
end;
$$;

-- 5) submit_run(..., p_level): as before, on one board. ------------------------
drop function if exists public.submit_run(uuid, text, int);

create or replace function public.submit_run(
  p_match uuid,
  p_name  text,
  p_score int,
  p_level int default 0
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
begin
  if p_name !~ '^[A-Z0-9]{3,6}$' then
    raise exception 'invalid name';
  end if;
  if p_score is null or p_score < 0 or p_score > public.board_score_cap(p_level) then
    raise exception 'invalid score';
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

  -- Plausibility: the same generous points-per-second cap as before. A story
  -- run submits its stage scores at the end of the run, so a stage ticket's
  -- elapsed time is at least the stage's length.
  v_elapsed := extract(epoch from (now() - v_issued));
  v_cap := least(public.board_score_cap(p_level), ceil(v_elapsed * 3000) + 5000);
  if p_score > v_cap then
    raise exception 'implausible score for elapsed time';
  end if;

  insert into public.scores (name, score, level)
  values (p_name, p_score, p_level)
  returning id into v_id;

  return query
    select v_id,
           (select count(*)::int + 1
              from public.scores s
             where s.level = p_level and s.score > p_score);
end;
$$;

-- 6) get_rank(s, p_level): rank on one board (competition ranking). ------------
drop function if exists public.get_rank(int);

create or replace function public.get_rank(s int, p_level int default 0)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int + 1 from public.scores where level = p_level and score > s;
$$;

-- 7) The browser (anon) may call only these. -----------------------------------
revoke all on function public.start_match(int) from public;
revoke all on function public.submit_run(uuid, text, int, int) from public;
revoke all on function public.get_rank(int, int) from public;
grant execute on function public.start_match(int) to anon, authenticated;
grant execute on function public.submit_run(uuid, text, int, int) to anon, authenticated;
grant execute on function public.get_rank(int, int) to anon, authenticated;

commit;
