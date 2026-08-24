-- ============================================================================
-- Geography and places.
--
-- CRITICAL INVARIANT (Google Maps Platform terms):
--   `places`      -> permanent. Holds place_id and OUR OWN derived facets only.
--   `place_cache` -> Google Maps Content. TTL-bounded, lazily rehydrated, never
--                    joined into anything durable. Rows past `expires_at` must be
--                    treated as absent by the application layer and are swept by cron.
-- See docs/ARCHITECTURE.md §3.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Destinations: curated, ours.
-- ---------------------------------------------------------------------------
create table public.destinations (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  kind             public.destination_kind not null,
  country_code     char(2) not null,
  country_name     text not null,
  parent_id        uuid references public.destinations(id) on delete set null,
  lat              double precision not null,
  lng              double precision not null,
  timezone         text not null,                       -- IANA, required for opening-hours validation
  bbox             jsonb,                               -- {north,south,east,west}
  google_place_id  text unique,
  cost_index       numeric(6,3) not null default 1.000, -- 1.000 == baseline (see domain/cost)
  currency         char(3),
  hero_image_url   text,
  hero_credit      jsonb,                               -- {author, authorUrl, source, sourceUrl}
  blurb            text,
  is_curated       boolean not null default false,
  trip_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint destinations_lat_range check (lat between -90 and 90),
  constraint destinations_lng_range check (lng between -180 and 180)
);

create index destinations_parent_idx  on public.destinations (parent_id);
create index destinations_country_idx on public.destinations (country_code);
create index destinations_curated_idx on public.destinations (trip_count desc) where is_curated;
create index destinations_name_trgm   on public.destinations using gin (name extensions.gin_trgm_ops);

create trigger destinations_set_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Places: permanent, ID-only. NO Google Maps Content in this table.
-- ---------------------------------------------------------------------------
create table public.places (
  id               uuid primary key default gen_random_uuid(),
  google_place_id  text not null unique,
  destination_id   uuid references public.destinations(id) on delete set null,
  primary_type     text,          -- Google type taxonomy; a classifier key, not content
  types            text[] not null default '{}',
  tags             text[] not null default '{}',   -- OUR taxonomy (see domain/types/tags)
  created_at       timestamptz not null default now()
);

create index places_destination_idx on public.places (destination_id, primary_type);
create index places_tags_idx        on public.places using gin (tags);

-- ---------------------------------------------------------------------------
-- Place cache: Google Maps Content. Ephemeral by contract.
-- ---------------------------------------------------------------------------
create table public.place_cache (
  place_id          uuid primary key references public.places(id) on delete cascade,
  display_name      text,
  formatted_address text,
  lat               double precision,
  lng               double precision,
  rating            numeric(2,1),
  user_rating_count integer,
  price_level       text,
  price_range       jsonb,
  opening_hours     jsonb,
  website_uri       text,
  google_maps_uri   text,
  editorial_summary text,
  photo_names       text[],
  business_status   text,
  payload           jsonb,        -- raw response, for field-mask debugging
  fetched_at        timestamptz not null default now(),
  expires_at        timestamptz not null,

  constraint place_cache_ttl_bounded
    check (expires_at <= fetched_at + interval '30 days')
);

create index place_cache_expiry_idx on public.place_cache (expires_at);

-- ---------------------------------------------------------------------------
-- Place signals: OURS. Behavioural (clone/save rates) and editorial curation.
-- Deliberately not derived from Google content so it survives cache expiry.
-- ---------------------------------------------------------------------------
create table public.place_signals (
  place_id   uuid not null references public.places(id) on delete cascade,
  tag        text not null,
  score      numeric(6,4) not null default 0,
  source     public.signal_source not null default 'behavioural',
  updated_at timestamptz not null default now(),
  primary key (place_id, tag)
);

-- ---------------------------------------------------------------------------
-- Route legs: Routes API content, also TTL-bounded.
-- `depart_bucket` is the hour-of-week (0-167) so cached legs reflect traffic shape.
-- ---------------------------------------------------------------------------
create table public.route_legs (
  origin_place_id  uuid not null references public.places(id) on delete cascade,
  dest_place_id    uuid not null references public.places(id) on delete cascade,
  mode             public.transport_mode not null,
  depart_bucket    smallint not null,
  duration_s       integer not null,
  distance_m       integer not null,
  polyline         text,
  fetched_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  primary key (origin_place_id, dest_place_id, mode, depart_bucket),

  constraint route_legs_bucket_range check (depart_bucket between 0 and 167),
  constraint route_legs_ttl_bounded  check (expires_at <= fetched_at + interval '30 days')
);

create index route_legs_expiry_idx on public.route_legs (expires_at);

-- ---------------------------------------------------------------------------
-- RLS: all four tables are shared infrastructure. Readable by anyone (the data
-- is either ours-and-public or already public via Google), writable only by the
-- service role (the generation worker and cache-refresh cron).
-- ---------------------------------------------------------------------------
alter table public.destinations  enable row level security;
alter table public.places        enable row level security;
alter table public.place_cache   enable row level security;
alter table public.place_signals enable row level security;
alter table public.route_legs    enable row level security;

create policy destinations_read  on public.destinations  for select using (true);
create policy places_read        on public.places        for select using (true);
create policy place_cache_read   on public.place_cache   for select using (expires_at > now());
create policy place_signals_read on public.place_signals for select using (true);
create policy route_legs_read    on public.route_legs    for select using (expires_at > now());

-- No insert/update/delete policies: service role bypasses RLS, everyone else is denied.
