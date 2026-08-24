-- Destination trip counts drive the discovery surface and corpus warming
-- priority. Incremented via RPC so the trips column guard stays intact.
create or replace function public.bump_destination_trip_count(d uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.destinations set trip_count = trip_count + 1 where id = d;
$$;

revoke execute on function public.bump_destination_trip_count(uuid) from public;
