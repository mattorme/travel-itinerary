-- ============================================================================
-- Destination hub statistics.
--
-- The architecture argues destination hubs are the real SEO asset and that
-- individual trip pages mostly should not be indexed. That only holds if the
-- hub actually says something — a name and a list of cards is a thin page, and
-- thin pages are the problem, not the solution.
--
-- Everything here is aggregated from trips people have actually planned, so the
-- page gets better as the corpus grows rather than needing to be written.
-- ============================================================================

create or replace function public.destination_stats(p_destination_id uuid)
returns table (
  trip_count        integer,
  median_days       numeric,
  min_days          integer,
  max_days          integer,
  median_cost       numeric,
  currency          text,
  top_interests     text[],
  common_pace       text,
  common_style      text
)
language sql
stable
security definer
set search_path = public
as $$
  with public_trips as (
    select t.*
      from public.trips t
      join public.trip_destinations td on td.trip_id = t.id
     where td.destination_id = p_destination_id
       and t.visibility = 'public'
       and t.moderation_state = 'approved'
       and t.status = 'ready'
       and t.deleted_at is null
  ),
  interests as (
    select unnest(interests) as interest from public_trips
  )
  select
    (select count(*)::integer from public_trips),
    (select percentile_cont(0.5) within group (order by duration_days) from public_trips),
    (select min(duration_days)::integer from public_trips),
    (select max(duration_days)::integer from public_trips),
    -- Median, not mean: one luxury outlier should not describe the destination.
    (select percentile_cont(0.5) within group (order by estimated_cost_total)
       from public_trips where estimated_cost_total is not null),
    (select mode() within group (order by currency::text) from public_trips),
    (select array_agg(interest order by n desc)
       from (select interest, count(*) as n from interests group by interest order by n desc limit 5) top),
    (select mode() within group (order by pace::text) from public_trips),
    (select mode() within group (order by travel_style::text) from public_trips);
$$;

revoke execute on function public.destination_stats(uuid) from public;
grant  execute on function public.destination_stats(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The places that actually turn up in itineraries here.
--
-- Ranked by how many distinct trips use them rather than by rating: a place
-- that twenty separate travellers ended up at is a better recommendation than
-- one with a high score and no takers. Only Google-cached content that is still
-- live is returned, so this respects the same TTL as everything else.
-- ---------------------------------------------------------------------------
create or replace function public.destination_top_places(
  p_destination_id uuid,
  p_limit integer default 8
)
returns table (
  place_id uuid,
  name text,
  tags text[],
  rating numeric,
  user_rating_count integer,
  trips integer,
  maps_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    c.display_name,
    p.tags,
    c.rating,
    c.user_rating_count,
    count(distinct t.id)::integer as trips,
    c.google_maps_uri
  from public.places p
  join public.place_cache c on c.place_id = p.id and c.expires_at > now()
  join public.activities a on a.place_id = p.id
  join public.trip_days d on d.id = a.trip_day_id
  join public.trips t on t.id = d.trip_id
  where p.destination_id = p_destination_id
    and t.visibility = 'public'
    and t.moderation_state = 'approved'
    and t.deleted_at is null
    and c.display_name is not null
  group by p.id, c.display_name, p.tags, c.rating, c.user_rating_count, c.google_maps_uri
  order by count(distinct t.id) desc, c.user_rating_count desc nulls last
  limit greatest(1, least(p_limit, 24));
$$;

revoke execute on function public.destination_top_places(uuid, integer) from public;
grant  execute on function public.destination_top_places(uuid, integer) to anon, authenticated, service_role;
