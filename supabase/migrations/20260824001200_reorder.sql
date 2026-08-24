-- ============================================================================
-- Reordering activities.
--
-- This has to be one statement. The unique constraint on
-- (trip_day_id, order_index) is DEFERRABLE, but PostgREST issues each row update
-- as its own transaction, so deferral buys nothing across a sequence of REST
-- calls: the first update collides with the index the next row still holds.
--
-- Doing it in a single function means the constraint is genuinely deferred to
-- commit, and the whole reorder is atomic — a half-applied order is not a state
-- the itinerary should ever be in.
-- ============================================================================

create or replace function public.reorder_activities(
  p_day_id      uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_count   int;
begin
  select trip_id into v_trip_id from public.trip_days where id = p_day_id;
  if v_trip_id is null then
    raise exception 'day not found' using errcode = 'P0002';
  end if;

  -- SECURITY DEFINER bypasses RLS, so authorisation is explicit here.
  if not public.can_edit_trip(v_trip_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  -- Every id must belong to this day, and the list must be complete. Otherwise a
  -- caller could drop activities by omitting them, or smuggle in another day's.
  select count(*) into v_count from public.activities where trip_day_id = p_day_id;
  -- array_length returns NULL for an empty array, and `x <> NULL` is NULL, so
  -- without the coalesce an empty ordering slips past this guard entirely.
  if v_count <> coalesce(array_length(p_ordered_ids, 1), 0) then
    raise exception 'ordering must list every activity in the day exactly once'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) as id
     where id not in (select a.id from public.activities a where a.trip_day_id = p_day_id)
  ) then
    raise exception 'ordering contains an activity from another day' using errcode = '22023';
  end if;

  set constraints public.activities_order_unique deferred;

  update public.activities a
     set order_index = t.new_index
    from (
      select id, ordinality::int as new_index
        from unnest(p_ordered_ids) with ordinality as u(id, ordinality)
    ) t
   where a.id = t.id and a.trip_day_id = p_day_id;
end;
$$;

revoke execute on function public.reorder_activities(uuid, uuid[]) from public;
grant  execute on function public.reorder_activities(uuid, uuid[]) to authenticated, anon;
