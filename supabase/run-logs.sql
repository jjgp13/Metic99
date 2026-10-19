-- =============================================================================
-- Metic99 run logs: every finished run (or story level) from the public game
-- =============================================================================
-- Run AFTER match-gate.sql and story-boards.sql, in the Supabase SQL editor.
--
-- The game (src/services/playtestLog.ts) sends one record per finished run:
-- the seed and the input log (enough to replay the run exactly with
-- `npm run playtest`), a summary, solves, hits and input sources. Nothing
-- personal: no name, no IP, no user agent; only the screen size and whether
-- it is a touch device.
--
-- Write-only for the browser: the anon key may only call log_run(), which
-- checks the shape and size; nobody can read the table through the API
-- (RLS on, no policies). The owner reads it in the dashboard or with SQL.
-- =============================================================================

begin;

create table if not exists public.run_logs (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  build      text not null,           -- the game build (git commit)
  mode       text not null,           -- endless / story / battle
  level      smallint,                -- story: level index (0 = level 1)
  data       jsonb not null           -- the run record
);

create index if not exists run_logs_created_idx on public.run_logs (created_at desc);

alter table public.run_logs enable row level security;  -- no policies: no API access
revoke all on public.run_logs from anon, authenticated;

create or replace function public.log_run(
  p_build text,
  p_mode  text,
  p_level int,
  p_data  jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mode is null or p_mode not in ('endless', 'story', 'battle') then
    raise exception 'invalid mode';
  end if;
  if p_build is null or length(p_build) > 64 then
    raise exception 'invalid build';
  end if;
  if p_level is not null and (p_level < 0 or p_level > 99) then
    raise exception 'invalid level';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 200000 then
    raise exception 'invalid run';
  end if;
  -- A crude flood guard (RPC has no easy IP access): at most 300 runs per
  -- 10 minutes for the whole game, far above real play today.
  if (select count(*) from public.run_logs where created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'too many runs right now';
  end if;

  insert into public.run_logs (build, mode, level, data)
  values (p_build, p_mode, p_level, p_data);
end;
$$;

revoke all on function public.log_run(text, text, int, jsonb) from public;
grant execute on function public.log_run(text, text, int, jsonb) to anon, authenticated;

commit;
