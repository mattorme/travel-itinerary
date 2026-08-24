-- ============================================================================
-- Trip authorisation.
--
-- `can_read_trip` is SECURITY DEFINER + STABLE so child-table policies evaluate
-- it once per statement rather than re-running the parent policy per row.
-- ============================================================================

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

create or replace function public.can_edit_trip(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips tr
     where tr.id = t and tr.deleted_at is null and tr.owner_id = auth.uid()
  );
$$;

-- Child-table helper: resolve trip from a day id.
create or replace function public.trip_id_for_day(d uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select trip_id from public.trip_days where id = d;
$$;

revoke execute on function public.can_read_trip(uuid)    from public;
revoke execute on function public.can_edit_trip(uuid)    from public;
revoke execute on function public.trip_id_for_day(uuid)  from public;
grant  execute on function public.can_read_trip(uuid)    to authenticated, anon;
grant  execute on function public.can_edit_trip(uuid)    to authenticated, anon;
grant  execute on function public.trip_id_for_day(uuid)  to authenticated, anon;

-- ---------------------------------------------------------------------------
alter table public.trips             enable row level security;
alter table public.trip_destinations enable row level security;
alter table public.trip_days         enable row level security;
alter table public.activities        enable row level security;

-- Trips ---------------------------------------------------------------------
create policy trips_read on public.trips
  for select using (
    deleted_at is null
    and (
      owner_id = auth.uid()
      or (visibility in ('public', 'unlisted') and moderation_state <> 'blocked')
    )
  );

-- Ownership is derived from the session, never from the request body.
create policy trips_insert_own on public.trips
  for insert with check (owner_id = auth.uid());

create policy trips_update_own on public.trips
  for update using (owner_id = auth.uid() and deleted_at is null)
  with check (owner_id = auth.uid());

create policy trips_delete_own on public.trips
  for delete using (owner_id = auth.uid());

-- Children ------------------------------------------------------------------
create policy trip_destinations_read on public.trip_destinations
  for select using (public.can_read_trip(trip_id));
create policy trip_destinations_write on public.trip_destinations
  for all using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy trip_days_read on public.trip_days
  for select using (public.can_read_trip(trip_id));
create policy trip_days_write on public.trip_days
  for all using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy activities_read on public.activities
  for select using (public.can_read_trip(public.trip_id_for_day(trip_day_id)));
create policy activities_write on public.activities
  for all using (public.can_edit_trip(public.trip_id_for_day(trip_day_id)))
  with check (public.can_edit_trip(public.trip_id_for_day(trip_day_id)));

-- ---------------------------------------------------------------------------
-- Column guard: counters, lineage, moderation and indexability are system-owned.
-- Without this, `trips_update_own` would let an owner set is_featured, fake a
-- clone_count, or rewrite their trip's provenance.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: the guard needs to observe the CALLER's
-- database role. As SECURITY DEFINER, current_user would always be the
-- function owner and the guard would never fire.
create or replace function public.guard_trip_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- `current_user` is the effective database role and cannot be spoofed from a
  -- JWT. `auth.role()` reads request claims, so a SECURITY DEFINER system
  -- function would still be treated as an untrusted caller and have its writes
  -- reverted here. Do not switch this back.
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.like_count              := old.like_count;
    new.save_count              := old.save_count;
    new.view_count              := old.view_count;
    new.clone_count             := old.clone_count;
    new.share_count             := old.share_count;
    new.quality_score           := old.quality_score;
    new.is_indexable            := old.is_indexable;
    new.is_featured             := old.is_featured;
    new.moderation_state        := old.moderation_state;
    new.forked_from_trip_id     := old.forked_from_trip_id;
    new.forked_from_version     := old.forked_from_version;
    new.root_trip_id            := old.root_trip_id;
    new.origin_creator_username := old.origin_creator_username;
    new.origin_title            := old.origin_title;
    new.owner_id                := old.owner_id;
    new.slug                    := old.slug;
    new.created_at              := old.created_at;

    -- Publishing bumps published_at exactly once, server-side.
    if new.visibility = 'public' and old.visibility <> 'public' then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger trips_guard_columns
  before update on public.trips
  for each row execute function public.guard_trip_columns();

-- Same for inserts: a client must not seed counters or lineage.
-- SECURITY INVOKER on purpose: the guard needs to observe the CALLER's
-- database role. As SECURITY DEFINER, current_user would always be the
-- function owner and the guard would never fire.
create or replace function public.guard_trip_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- `current_user` is the effective database role and cannot be spoofed from a
  -- JWT. `auth.role()` reads request claims, so a SECURITY DEFINER system
  -- function would still be treated as an untrusted caller and have its writes
  -- reverted here. Do not switch this back.
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.like_count := 0; new.save_count := 0; new.view_count := 0;
    new.clone_count := 0; new.share_count := 0;
    new.quality_score := 0; new.is_indexable := false; new.is_featured := false;
    new.moderation_state := 'pending';
    new.forked_from_trip_id := null; new.forked_from_version := null;
    new.root_trip_id := null;
    new.origin_creator_username := null; new.origin_title := null;
    new.version := 1;
  end if;
  return new;
end;
$$;

create trigger trips_guard_insert
  before insert on public.trips
  for each row execute function public.guard_trip_insert();
