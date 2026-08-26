-- ============================================================================
-- Soft delete has never worked for trips.
--
-- Postgres applies the SELECT policy to the NEW row of an UPDATE. `trips_read`
-- required `deleted_at is null`, so the moment an owner set `deleted_at` the
-- resulting row failed its own read policy and the statement was rejected with
-- "new row violates row-level security policy for table trips".
--
-- Nothing in the UI called deleteTrip until now, so the failure was invisible.
-- The identical mistake was already made and fixed for `comments`; this is the
-- second instance of the same trap.
--
-- RULE: if a SELECT policy filters on a column, that column cannot be set by an
-- UPDATE unless the policy still admits the resulting row for that caller.
-- ============================================================================

drop policy if exists trips_read on public.trips;

create policy trips_read on public.trips
  for select using (
    -- An owner sees their own trips, including deleted ones. Without this, they
    -- cannot delete them. Listing queries filter `deleted_at is null`
    -- themselves, so a deleted trip still does not appear anywhere.
    owner_id = auth.uid()
    or (
      deleted_at is null
      and visibility in ('public', 'unlisted')
      and moderation_state <> 'blocked'
    )
  );

-- `trips_update_own` keeps `deleted_at is null` in its USING clause, which is
-- correct and deliberate: it stops a trip being edited after deletion, while
-- still allowing the delete itself because USING is evaluated against the OLD
-- row.

-- ---------------------------------------------------------------------------
-- Everything hanging off a trip must disappear with it. `can_read_trip` already
-- excludes deleted trips, so children are unreachable — but the owner-visible
-- path above would otherwise leak them back for the owner alone. Deleted means
-- deleted for reading; only the trip row itself stays visible to its owner so
-- the delete can happen at all.
-- ---------------------------------------------------------------------------
create or replace function public.can_read_trip(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.trips tr
     where tr.id = t
       and tr.deleted_at is null
       and (
         tr.owner_id = auth.uid()
         or (tr.visibility in ('public', 'unlisted') and tr.moderation_state <> 'blocked')
       )
  );
$$;
