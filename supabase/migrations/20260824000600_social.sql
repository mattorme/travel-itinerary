-- ============================================================================
-- Social: likes, saves, clones, events. Follows/comments are schema-only for now
-- (see docs/ROADMAP.md "Deferred") so the tables exist before they are needed.
-- ============================================================================

create table public.trip_likes (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, profile_id)
);
create index trip_likes_profile_idx on public.trip_likes (profile_id, created_at desc);

create table public.trip_saves (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, profile_id)
);
create index trip_saves_profile_idx on public.trip_saves (profile_id, created_at desc);

create table public.trip_clones (
  id             uuid primary key default gen_random_uuid(),
  source_trip_id uuid not null references public.trips(id) on delete cascade,
  cloned_trip_id uuid not null unique references public.trips(id) on delete cascade,
  cloner_id      uuid not null references public.profiles(id) on delete cascade,
  source_version integer not null,
  created_at     timestamptz not null default now()
);
create index trip_clones_source_idx on public.trip_clones (source_trip_id, created_at desc);
create index trip_clones_cloner_idx on public.trip_clones (cloner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Append-only event log. One table rather than trip_views/trip_shares: same
-- shape, same access pattern, one rollup job. `actor_hash` is a salted hash of
-- (ip, user-agent, day) — never raw IP, so this stays out of PII territory.
-- ---------------------------------------------------------------------------
create table public.trip_events (
  id            uuid not null default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  event_type    public.trip_event_type not null,
  actor_hash    text,
  profile_id    uuid references public.profiles(id) on delete set null,
  channel       text,
  referrer_host text,
  country       char(2),
  created_at    timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

create index trip_events_trip_idx on public.trip_events (trip_id, created_at desc);
-- Dedupe view spam. A unique index cannot be used here: on a partitioned table
-- the unique key must contain the partition column verbatim, and `created_at`
-- truncated to a day is an expression. `record_trip_event` therefore guards with
-- a lookback query against this index. The worst case under a race is one
-- double-counted view, which is acceptable for an engagement metric.
create index trip_events_view_dedupe
  on public.trip_events (trip_id, actor_hash, created_at desc)
  where event_type = 'view' and actor_hash is not null;

-- Rolling partitions; the maintenance cron creates the next month ahead of time.
create or replace function public.ensure_trip_events_partition(target date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  start_at date := date_trunc('month', target)::date;
  end_at   date := (date_trunc('month', target) + interval '1 month')::date;
  part     text := format('trip_events_%s', to_char(start_at, 'YYYYMM'));
begin
  if to_regclass('public.' || part) is null then
    execute format(
      'create table public.%I partition of public.trip_events for values from (%L) to (%L)',
      part, start_at, end_at
    );
  end if;
end;
$$;

select public.ensure_trip_events_partition(current_date);
select public.ensure_trip_events_partition((current_date + interval '1 month')::date);
select public.ensure_trip_events_partition((current_date + interval '2 month')::date);

-- ---------------------------------------------------------------------------
-- Deferred features: schema now so migrations stay additive.
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create table public.comments (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  author_id        uuid not null references public.profiles(id) on delete cascade,
  parent_id        uuid references public.comments(id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  moderation_state public.moderation_state not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index comments_trip_idx on public.comments (trip_id, created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Counter maintenance. Likes and saves are synchronous (must feel instant).
-- Views and shares are NOT: a synchronous UPDATE on a trending trip is a lock
-- convoy. They roll up from trip_events on a schedule.
-- ---------------------------------------------------------------------------
create or replace function public.bump_trip_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  tid   uuid := case when tg_op = 'INSERT' then new.trip_id else old.trip_id end;
begin
  if tg_argv[0] = 'like' then
    update public.trips set like_count = greatest(0, like_count + delta) where id = tid;
  elsif tg_argv[0] = 'save' then
    update public.trips set save_count = greatest(0, save_count + delta) where id = tid;
  end if;
  return null;
end;
$$;

create trigger trip_likes_counter
  after insert or delete on public.trip_likes
  for each row execute function public.bump_trip_counter('like');

create trigger trip_saves_counter
  after insert or delete on public.trip_saves
  for each row execute function public.bump_trip_counter('save');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.trip_likes  enable row level security;
alter table public.trip_saves  enable row level security;
alter table public.trip_clones enable row level security;
alter table public.trip_events enable row level security;
alter table public.follows     enable row level security;
alter table public.comments    enable row level security;

-- Likes are public signal on readable trips; saves are private to the saver.
create policy trip_likes_read on public.trip_likes
  for select using (public.can_read_trip(trip_id));
create policy trip_likes_write on public.trip_likes
  for insert with check (profile_id = auth.uid() and public.can_read_trip(trip_id));
create policy trip_likes_delete on public.trip_likes
  for delete using (profile_id = auth.uid());

create policy trip_saves_read on public.trip_saves
  for select using (profile_id = auth.uid());
create policy trip_saves_write on public.trip_saves
  for insert with check (profile_id = auth.uid() and public.can_read_trip(trip_id));
create policy trip_saves_delete on public.trip_saves
  for delete using (profile_id = auth.uid());

-- Clone edges are readable when either endpoint is readable (drives attribution UI).
create policy trip_clones_read on public.trip_clones
  for select using (public.can_read_trip(source_trip_id) or public.can_read_trip(cloned_trip_id));
-- Writes only via the clone_trip RPC (service definer). No insert policy.

-- Events are write-only from the client's perspective: analytics is not public.
create policy trip_events_insert on public.trip_events
  for insert with check (public.can_read_trip(trip_id));
create policy trip_events_read_own on public.trip_events
  for select using (public.can_edit_trip(trip_id));

create policy follows_read   on public.follows for select using (true);
create policy follows_write  on public.follows for insert with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete using (follower_id = auth.uid());

create policy comments_read on public.comments
  for select using (public.can_read_trip(trip_id) and deleted_at is null and moderation_state <> 'blocked');
create policy comments_write on public.comments
  for insert with check (author_id = auth.uid() and public.can_read_trip(trip_id));
create policy comments_update_own on public.comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
