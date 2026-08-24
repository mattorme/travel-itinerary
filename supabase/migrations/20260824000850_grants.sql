-- ============================================================================
-- Explicit table grants.
--
-- RLS decides WHICH ROWS a caller may touch; grants decide whether they may
-- touch the table at all. Relying on `alter default privileges` makes the
-- security posture depend on which role ran the migration, so every table is
-- granted here deliberately. Anything absent from this file is service-role only.
-- ============================================================================

grant usage on schema public to anon, authenticated;

-- Shared reference data: read-only for everyone, written by the worker.
grant select on public.destinations  to anon, authenticated;
grant select on public.places        to anon, authenticated;
grant select on public.place_cache   to anon, authenticated;
grant select on public.place_signals to anon, authenticated;
grant select on public.route_legs    to anon, authenticated;
grant select on public.fx_rates      to anon, authenticated;

-- Owned content. RLS narrows these to rows the caller owns or may read.
grant select, insert, update, delete on public.trips             to anon, authenticated;
grant select, insert, update, delete on public.trip_destinations to anon, authenticated;
grant select, insert, update, delete on public.trip_days         to anon, authenticated;
grant select, insert, update, delete on public.activities        to anon, authenticated;

grant select, update on public.profiles to anon, authenticated;

-- Social.
grant select, insert, delete on public.trip_likes to anon, authenticated;
grant select, insert, delete on public.trip_saves to anon, authenticated;
grant select                 on public.trip_clones to anon, authenticated;
grant select, insert         on public.trip_events to anon, authenticated;
grant select, insert, delete on public.follows     to anon, authenticated;
grant select, insert, update on public.comments    to anon, authenticated;

-- Job progress: the client subscribes to its own row over Realtime.
grant select on public.generation_jobs to anon, authenticated;

-- Deliberately NOT granted to anon/authenticated:
--   ai_generations, api_usage  -- cost data must not be enumerable by users

-- ---------------------------------------------------------------------------
-- service_role.
--
-- Bypassing RLS is NOT the same as having table privileges: without these the
-- worker gets a 403 from PostgREST on every table, and the failure surfaces as
-- something unrelated (a quota check failing closed, say) rather than as a
-- permissions error. Do not rely on `alter default privileges` here — it binds
-- to whichever role created the table.
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;
