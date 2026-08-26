-- ============================================================================
-- Trip search.
--
-- Explore had sorting and duration filters but no search, which is fine at six
-- trips and useless at six thousand.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- array_to_string is declared STABLE, not IMMUTABLE, because for `anyarray`
-- Postgres cannot prove the element type's output function is immutable — so a
-- generated column cannot use it. For text[] with a constant separator it
-- genuinely is immutable, and this narrowly-typed wrapper says so.
--
-- Do not widen this to anyarray. Marking a non-immutable function immutable
-- silently corrupts every index built on it.
-- ---------------------------------------------------------------------------
create or replace function public.text_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$ select array_to_string(coalesce(arr, '{}'::text[]), sep) $$;

-- ---------------------------------------------------------------------------
-- A generated tsvector, so there is no trigger to forget and no way for the
-- index to drift from the row. Weighted: a word in the title should beat the
-- same word buried in a summary.
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', public.text_array_to_string(interests, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('english', public.text_array_to_string(highlights, ' ')), 'C')
  ) stored;

create index if not exists trips_search_idx
  on public.trips using gin (search_vector)
  where visibility = 'public' and deleted_at is null;

-- Destination names are not on the trip row, so they are matched by join.
-- Trigram, not full text: people search "toyko" and "kyot" as often as not.
create index if not exists destinations_name_search_idx
  on public.destinations using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- search_trips
--
-- One function rather than a query built in TypeScript, because the ranking has
-- to combine three things that only the database can see cheaply: text
-- relevance, destination match, and how much other people liked the trip. A
-- purely textual ranking surfaces whatever happens to repeat a word most.
-- ---------------------------------------------------------------------------
create or replace function public.search_trips(
  p_query    text default null,
  p_min_days integer default null,
  p_max_days integer default null,
  p_style    text default null,
  p_interest text default null,
  p_sort     text default 'relevance',
  p_limit    integer default 24,
  p_offset   integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  subtitle text,
  duration_days integer,
  currency text,
  estimated_cost_total numeric,
  hero_image_url text,
  hero_credit jsonb,
  clone_count integer,
  like_count integer,
  interests text[],
  travel_style text,
  username text,
  display_name text,
  avatar_url text,
  rank real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select case
      when p_query is null or btrim(p_query) = '' then null
      -- websearch_to_tsquery understands quoted phrases and OR, and never
      -- raises on punctuation the way to_tsquery does.
      else websearch_to_tsquery('english', p_query)
    end as ts,
    -- Escaped for LIKE. The value is parameterised, so this is not about
    -- injection — it is that `%` and `_` are wildcards, and a search for "%"
    -- would otherwise match every destination we have.
    replace(replace(replace(
      nullif(btrim(coalesce(p_query, '')), ''),
      '\\', '\\\\'), '%', '\\%'), '_', '\\_') as raw
  )
  select
    t.id, t.slug, t.title, t.subtitle, t.duration_days, t.currency::text,
    t.estimated_cost_total, t.hero_image_url, t.hero_credit,
    t.clone_count, t.like_count, t.interests, t.travel_style::text,
    p.username::text, p.display_name, p.avatar_url,
    (
      coalesce(ts_rank(t.search_vector, q.ts), 0)
      -- A destination-name hit is what most searches actually mean, so it is
      -- worth more than a passing textual mention.
      + case when q.raw is not null and exists (
          select 1 from public.trip_destinations td
            join public.destinations d on d.id = td.destination_id
           where td.trip_id = t.id and d.name ilike '%' || q.raw || '%'
        ) then 1.0 else 0 end
      -- Social proof, compressed so a viral trip cannot bury an exact match.
      + least(ln(1 + t.clone_count * 3 + t.like_count) / 10.0, 0.5)
    )::real as rank
  from public.trips t
  join public.profiles p on p.id = t.owner_id
  cross join q
  where t.visibility = 'public'
    and t.moderation_state = 'approved'
    and t.status = 'ready'
    and t.deleted_at is null
    and (p_min_days is null or t.duration_days >= p_min_days)
    and (p_max_days is null or t.duration_days <= p_max_days)
    and (p_style    is null or t.travel_style::text = p_style)
    and (p_interest is null or p_interest = any(t.interests))
    and (
      q.ts is null
      or t.search_vector @@ q.ts
      or exists (
        select 1 from public.trip_destinations td
          join public.destinations d on d.id = td.destination_id
         where td.trip_id = t.id and d.name ilike '%' || q.raw || '%'
      )
    )
  order by
    case when p_sort = 'relevance' then null else 0 end,
    case when p_sort = 'popular' then t.clone_count end desc nulls last,
    case when p_sort = 'liked'   then t.like_count  end desc nulls last,
    case when p_sort = 'recent'  then t.published_at end desc nulls last,
    -- Relevance is the fallback and the tie-breaker for every other sort.
    (
      coalesce(ts_rank(t.search_vector, q.ts), 0)
      + case when q.raw is not null and exists (
          select 1 from public.trip_destinations td
            join public.destinations d on d.id = td.destination_id
           where td.trip_id = t.id and d.name ilike '%' || q.raw || '%'
        ) then 1.0 else 0 end
      + least(ln(1 + t.clone_count * 3 + t.like_count) / 10.0, 0.5)
    ) desc,
    t.published_at desc nulls last
  limit greatest(1, least(p_limit, 60))
  offset greatest(0, p_offset);
$$;

revoke execute on function public.search_trips(text, integer, integer, text, text, text, integer, integer) from public;
grant  execute on function public.search_trips(text, integer, integer, text, text, text, integer, integer) to anon, authenticated, service_role;
