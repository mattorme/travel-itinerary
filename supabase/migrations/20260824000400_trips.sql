-- ============================================================================
-- Trips: the social object.
--
-- Everything in these tables is OURS (the plan, the narrative, user edits).
-- Google content enters only at render time via place_cache. A trip page must
-- render correctly with a completely cold place_cache — hence activities carry
-- their own authored `title`.
-- ============================================================================

create table public.trips (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references public.profiles(id) on delete cascade,
  slug                     text not null unique,

  title                    text not null,
  subtitle                 text,
  status                   public.trip_status not null default 'draft',
  visibility               public.trip_visibility not null default 'private',

  -- Request
  start_date               date,
  end_date                 date,
  duration_days            integer not null,
  date_mode                public.date_mode not null default 'exact',
  party                    jsonb not null default '{"adults":2,"children":[]}'::jsonb,
  currency                 char(3) not null default 'AUD',
  budget_total             numeric(12,2),
  budget_daily             numeric(12,2),
  travel_style             public.travel_style not null default 'balanced',
  pace                     public.trip_pace not null default 'balanced',
  interests                text[] not null default '{}',
  transport_modes          public.transport_mode[] not null default '{mixed}',
  food_prefs               text[] not null default '{}',
  accommodation_pref       public.accommodation_kind,
  user_notes               text check (char_length(user_notes) <= 2000),

  -- Result
  summary                  text,
  highlights               text[] not null default '{}',
  estimated_cost_total     numeric(12,2),
  estimated_cost_breakdown jsonb,
  hero_image_url           text,
  hero_credit              jsonb,

  -- Lineage
  forked_from_trip_id      uuid references public.trips(id) on delete set null,
  forked_from_version      integer,
  root_trip_id             uuid references public.trips(id) on delete set null,
  -- Denormalised so attribution survives deletion or a privacy change on the source.
  origin_creator_username  text,
  origin_title             text,

  version                  integer not null default 1,

  -- Denormalised counters. likes/saves/clones are trigger-maintained (low volume,
  -- must feel instant). views/shares are rolled up from trip_events on a schedule.
  like_count               integer not null default 0,
  save_count               integer not null default 0,
  view_count               integer not null default 0,
  clone_count              integer not null default 0,
  share_count              integer not null default 0,

  quality_score            numeric(6,3) not null default 0,
  is_indexable             boolean not null default false,
  is_featured              boolean not null default false,
  moderation_state         public.moderation_state not null default 'pending',

  published_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,

  constraint trips_duration_range check (duration_days between 1 and 60),
  constraint trips_date_order     check (start_date is null or end_date is null or end_date >= start_date),
  constraint trips_date_span      check (
    start_date is null or end_date is null or (end_date - start_date) = duration_days - 1
  ),
  constraint trips_budget_positive check (budget_total is null or budget_total >= 0),
  -- A trip cannot be indexable unless it is public and moderation-approved.
  constraint trips_indexable_requires_public check (
    not is_indexable or (visibility = 'public' and moderation_state = 'approved')
  )
);

create index trips_owner_idx    on public.trips (owner_id, updated_at desc) where deleted_at is null;
create index trips_public_idx   on public.trips (published_at desc)
  where visibility = 'public' and deleted_at is null and moderation_state = 'approved';
create index trips_indexable_idx on public.trips (quality_score desc)
  where is_indexable and deleted_at is null;
create index trips_forked_idx   on public.trips (forked_from_trip_id) where forked_from_trip_id is not null;
create index trips_root_idx     on public.trips (root_trip_id) where root_trip_id is not null;
create index trips_interests_idx on public.trips using gin (interests);
create index trips_style_idx    on public.trips (travel_style, duration_days)
  where visibility = 'public' and deleted_at is null;

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Multi-destination support. A single-city trip has exactly one row.
-- ---------------------------------------------------------------------------
create table public.trip_destinations (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  destination_id  uuid not null references public.destinations(id) on delete restrict,
  order_index     integer not null,
  first_day_index integer not null,
  nights          integer not null,
  -- Accommodation anchor: determines each day's geographic cluster and the
  -- first/last leg of every day. Not a booking.
  anchor_place_id uuid references public.places(id) on delete set null,
  anchor_label    text,
  unique (trip_id, order_index),
  constraint trip_destinations_nights_positive check (nights > 0)
);

create index trip_destinations_trip_idx on public.trip_destinations (trip_id, order_index);

-- ---------------------------------------------------------------------------
create table public.trip_days (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  day_index      integer not null,
  date           date,
  title          text not null,
  summary        text,
  destination_id uuid references public.destinations(id) on delete set null,
  estimated_cost numeric(12,2),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (trip_id, day_index),
  constraint trip_days_index_positive check (day_index >= 1)
);

create index trip_days_trip_idx on public.trip_days (trip_id, day_index);

create trigger trip_days_set_updated_at
  before update on public.trip_days
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  trip_day_id      uuid not null references public.trip_days(id) on delete cascade,
  order_index      integer not null,
  kind             public.activity_kind not null default 'activity',

  place_id         uuid references public.places(id) on delete set null,
  custom_name      text,   -- used when there is no Google place (e.g. "beach afternoon")

  -- Authored by us. Always renders, even with a cold place_cache.
  title            text not null,
  description      text,
  reason           text,   -- one line on why this fits the traveller

  start_time       time,
  end_time         time,
  duration_minutes integer,

  estimated_cost   numeric(10,2),
  cost_basis       public.cost_basis not null default 'modelled',

  -- Travel from the previous activity, resolved at generation time.
  inbound_travel   jsonb,  -- {mode, minutes, meters, polyline?, source:'routes'|'estimated'}

  booking_url      text,
  is_locked        boolean not null default false,  -- user pinned; repair must not move it
  source           public.activity_source not null default 'generated',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint activities_named check (place_id is not null or custom_name is not null),
  constraint activities_time_order check (start_time is null or end_time is null or end_time > start_time),
  constraint activities_duration_sane check (duration_minutes is null or duration_minutes between 5 and 1440)
);

-- Deferrable so a reorder can shuffle indices inside one transaction.
alter table public.activities
  add constraint activities_order_unique unique (trip_day_id, order_index)
  deferrable initially deferred;

create index activities_day_idx   on public.activities (trip_day_id, order_index);
create index activities_place_idx on public.activities (place_id) where place_id is not null;

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();
