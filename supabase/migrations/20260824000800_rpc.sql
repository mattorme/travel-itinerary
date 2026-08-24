-- ============================================================================
-- Server-side operations that must be atomic or must bypass the column guards.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Slug generation. Human-readable and stable: "japan-12-days-tokyo-kyoto-osaka".
-- Collisions get a short random suffix rather than a counter (no read-modify-write
-- race, and no leaking how many similar trips exist).
-- ---------------------------------------------------------------------------
-- unaccent is not always available on hosted projects; this is a good-enough fold.
create or replace function public.unaccent_fallback(input text)
returns text
language sql
immutable
as $$
  select translate(
    input,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
    'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
  );
$$;

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(unaccent_fallback(input)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

create or replace function public.unique_trip_slug(base text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := left(nullif(public.slugify(base), ''), 80);
begin
  if candidate is null then
    candidate := 'trip';
  end if;
  if not exists (select 1 from public.trips where slug = candidate) then
    return candidate;
  end if;
  return candidate || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
end;
$$;

-- ---------------------------------------------------------------------------
-- clone_trip: deep snapshot at the source's current version.
--
-- Snapshot rather than reference because (a) the cloner edits immediately,
-- (b) the original creator editing must not silently rewrite other people's
-- plans, (c) deletion or a privacy change on the source must not break clones.
-- Attribution is denormalised for the same reason. See docs/ARCHITECTURE.md §13.
-- ---------------------------------------------------------------------------
create or replace function public.clone_trip(source_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src        public.trips%rowtype;
  new_id     uuid;
  actor      uuid := auth.uid();
  origin_user text;
  day_map    jsonb := '{}'::jsonb;
  d          record;
  new_day_id uuid;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into src from public.trips
   where id = source_trip_id and deleted_at is null;

  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  -- Authorisation mirrors can_read_trip: you may clone what you may read.
  if not (src.owner_id = actor
          or (src.visibility in ('public','unlisted') and src.moderation_state <> 'blocked')) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  select username into origin_user from public.profiles where id = src.owner_id;

  insert into public.trips (
    owner_id, slug, title, subtitle, status, visibility,
    start_date, end_date, duration_days, date_mode, party, currency,
    budget_total, budget_daily, travel_style, pace, interests,
    transport_modes, food_prefs, accommodation_pref, user_notes,
    summary, highlights, estimated_cost_total, estimated_cost_breakdown,
    hero_image_url, hero_credit,
    forked_from_trip_id, forked_from_version, root_trip_id,
    origin_creator_username, origin_title,
    moderation_state
  ) values (
    actor,
    public.unique_trip_slug(src.title),
    src.title, src.subtitle, 'ready',
    'private',                        -- a clone is never born public
    src.start_date, src.end_date, src.duration_days, src.date_mode, src.party, src.currency,
    src.budget_total, src.budget_daily, src.travel_style, src.pace, src.interests,
    src.transport_modes, src.food_prefs, src.accommodation_pref, src.user_notes,
    src.summary, src.highlights, src.estimated_cost_total, src.estimated_cost_breakdown,
    src.hero_image_url, src.hero_credit,
    src.id, src.version, coalesce(src.root_trip_id, src.id),
    origin_user, src.title,
    src.moderation_state
  )
  returning id into new_id;

  insert into public.trip_destinations
    (trip_id, destination_id, order_index, first_day_index, nights, anchor_place_id, anchor_label)
  select new_id, destination_id, order_index, first_day_index, nights, anchor_place_id, anchor_label
    from public.trip_destinations where trip_id = src.id;

  for d in
    select * from public.trip_days where trip_id = src.id order by day_index
  loop
    insert into public.trip_days
      (trip_id, day_index, date, title, summary, destination_id, estimated_cost, notes)
    values
      (new_id, d.day_index, d.date, d.title, d.summary, d.destination_id, d.estimated_cost, d.notes)
    returning id into new_day_id;

    day_map := day_map || jsonb_build_object(d.id::text, new_day_id::text);
  end loop;

  insert into public.activities (
    trip_day_id, order_index, kind, place_id, custom_name, title, description, reason,
    start_time, end_time, duration_minutes, estimated_cost, cost_basis,
    inbound_travel, booking_url, is_locked, source
  )
  select
    (day_map ->> a.trip_day_id::text)::uuid,
    a.order_index, a.kind, a.place_id, a.custom_name, a.title, a.description, a.reason,
    a.start_time, a.end_time, a.duration_minutes, a.estimated_cost, a.cost_basis,
    a.inbound_travel, a.booking_url, false, 'cloned'
  from public.activities a
  join public.trip_days td on td.id = a.trip_day_id
  where td.trip_id = src.id;

  insert into public.trip_clones (source_trip_id, cloned_trip_id, cloner_id, source_version)
  values (src.id, new_id, actor, src.version);

  update public.trips set clone_count = clone_count + 1 where id = src.id;

  return new_id;
end;
$$;

revoke execute on function public.clone_trip(uuid) from public;
grant  execute on function public.clone_trip(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- record_trip_event: the only way a viewer may touch analytics. Deduped by the
-- partial unique index; conflicts are swallowed so a repeat view is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.record_trip_event(
  p_trip_id       uuid,
  p_event_type    public.trip_event_type,
  p_actor_hash    text default null,
  p_channel       text default null,
  p_referrer_host text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_read_trip(p_trip_id) then
    return;   -- silently ignore: never confirm the existence of a private trip
  end if;

  -- One view per actor per trip per 24h. See the note on trip_events_view_dedupe.
  if p_event_type = 'view' and p_actor_hash is not null then
    if exists (
      select 1 from public.trip_events
       where trip_id = p_trip_id
         and event_type = 'view'
         and actor_hash = p_actor_hash
         and created_at > now() - interval '24 hours'
    ) then
      return;
    end if;
  end if;

  insert into public.trip_events (trip_id, event_type, actor_hash, profile_id, channel, referrer_host)
  values (p_trip_id, p_event_type, p_actor_hash, auth.uid(), p_channel, left(p_referrer_host, 128));
end;
$$;

revoke execute on function public.record_trip_event(uuid, public.trip_event_type, text, text, text) from public;
grant  execute on function public.record_trip_event(uuid, public.trip_event_type, text, text, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Counter rollup, run by cron. Batched rather than synchronous per view.
-- ---------------------------------------------------------------------------
create or replace function public.rollup_trip_counters(since interval default interval '1 hour')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  with agg as (
    select trip_id,
           count(*) filter (where event_type = 'view')  as views,
           count(*) filter (where event_type = 'share') as shares
      from public.trip_events
     where created_at >= now() - since
     group by trip_id
  )
  update public.trips t
     set view_count  = t.view_count  + agg.views,
         share_count = t.share_count + agg.shares
    from agg
   where t.id = agg.trip_id and (agg.views > 0 or agg.shares > 0);

  get diagnostics touched = row_count;
  return touched;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cache sweep: enforce the Places TTL contract at the storage layer, not just
-- in policy. Expired Google content is deleted, place_id rows survive.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_expired_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  m integer := 0;
begin
  delete from public.place_cache where expires_at <= now();
  get diagnostics n = row_count;
  delete from public.route_legs where expires_at <= now();
  get diagnostics m = row_count;
  return n + m;
end;
$$;
