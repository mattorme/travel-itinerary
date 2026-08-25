-- ============================================================================
-- Follows and comments.
--
-- The tables were created up front so migrations stayed additive; this turns
-- them on. Counters and the toggle live in functions for the same reason the
-- trip counters do: a client must not be able to write them directly.
-- ============================================================================

alter table public.profiles
  add column if not exists follower_count  integer not null default 0,
  add column if not exists following_count integer not null default 0,
  add column if not exists trip_count      integer not null default 0;

-- ---------------------------------------------------------------------------
-- Follow counters
-- ---------------------------------------------------------------------------
create or replace function public.bump_follow_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  f uuid := case when tg_op = 'INSERT' then new.follower_id else old.follower_id end;
  t uuid := case when tg_op = 'INSERT' then new.followee_id else old.followee_id end;
begin
  update public.profiles set following_count = greatest(0, following_count + delta) where id = f;
  update public.profiles set follower_count  = greatest(0, follower_count  + delta) where id = t;
  return null;
end;
$$;

create trigger follows_counters
  after insert or delete on public.follows
  for each row execute function public.bump_follow_counters();

-- ---------------------------------------------------------------------------
-- Anonymous-account check.
--
-- SECURITY DEFINER because an anonymous profile has is_public = false, so a
-- SECURITY INVOKER guard querying `profiles` as the caller sees no row and
-- silently decides the account is not anonymous. The guards that call this stay
-- SECURITY INVOKER, because they also need to observe the caller's role.
-- ---------------------------------------------------------------------------
create or replace function public.is_anonymous_profile(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_anonymous from public.profiles where id = p_id), false);
$$;

revoke execute on function public.is_anonymous_profile(uuid) from public;
grant  execute on function public.is_anonymous_profile(uuid) to authenticated, anon;

-- Anonymous accounts must not be followable or able to follow: they are not
-- people yet, and letting them accrue a graph makes the upgrade path messy.
create or replace function public.guard_follow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_anonymous_profile(new.follower_id) then
    raise exception 'sign up before following people' using errcode = '42501';
  end if;
  if public.is_anonymous_profile(new.followee_id) then
    raise exception 'that account cannot be followed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger follows_guard
  before insert on public.follows
  for each row execute function public.guard_follow();

-- ---------------------------------------------------------------------------
-- Public trip count, so a profile page does not COUNT(*) on every render
-- ---------------------------------------------------------------------------
create or replace function public.refresh_profile_trip_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid := coalesce(new.owner_id, old.owner_id);
begin
  update public.profiles p
     set trip_count = (
       select count(*) from public.trips t
        where t.owner_id = owner
          and t.visibility = 'public'
          and t.deleted_at is null
          and t.moderation_state = 'approved'
     )
   where p.id = owner;
  return null;
end;
$$;

create trigger trips_profile_count
  after insert or update of visibility, deleted_at, moderation_state or delete
  on public.trips
  for each row execute function public.refresh_profile_trip_count();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists comment_count integer not null default 0;

create or replace function public.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  t uuid := case when tg_op = 'INSERT' then new.trip_id else old.trip_id end;
begin
  update public.trips set comment_count = greatest(0, comment_count + delta) where id = t;
  return null;
end;
$$;

create trigger comments_counter
  after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

-- A soft delete should decrement too, without deleting the row.
create or replace function public.bump_comment_count_on_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.trips set comment_count = greatest(0, comment_count - 1) where id = new.trip_id;
  elsif old.deleted_at is not null and new.deleted_at is null then
    update public.trips set comment_count = comment_count + 1 where id = new.trip_id;
  end if;
  return null;
end;
$$;

create trigger comments_soft_delete_counter
  after update of deleted_at on public.comments
  for each row execute function public.bump_comment_count_on_soft_delete();

-- Comments are a public surface on an indexable page, so an anonymous account
-- cannot post: there has to be something to moderate against.
create or replace function public.guard_comment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_anonymous_profile(new.author_id) then
    raise exception 'sign up before commenting' using errcode = '42501';
  end if;
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.moderation_state := 'pending';
  end if;
  return new;
end;
$$;

create trigger comments_guard
  before insert on public.comments
  for each row execute function public.guard_comment();

-- Only the author may soft-delete or edit the body; nobody self-approves.
create or replace function public.guard_comment_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.moderation_state := old.moderation_state;
    new.author_id        := old.author_id;
    new.trip_id          := old.trip_id;
    new.created_at       := old.created_at;
  end if;
  return new;
end;
$$;

create trigger comments_guard_update
  before update on public.comments
  for each row execute function public.guard_comment_update();

-- Reading a thread needs the author's public identity alongside the body.
create or replace function public.trip_comments(p_trip_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.body, c.created_at, c.author_id,
         p.username::text, p.display_name, p.avatar_url
    from public.comments c
    join public.profiles p on p.id = c.author_id
   where c.trip_id = p_trip_id
     and c.deleted_at is null
     and c.moderation_state <> 'blocked'
     and public.can_read_trip(p_trip_id)
   order by c.created_at asc
   limit 200;
$$;

revoke execute on function public.trip_comments(uuid) from public;
grant  execute on function public.trip_comments(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Read policy.
--
-- A comment in the moderation queue is invisible to everyone but its author
-- until it is approved.
--
-- The author clause must also cover deleted rows, and not only for reading:
-- Postgres applies the SELECT policy to the *new* row of an UPDATE, so a policy
-- that excludes `deleted_at is not null` makes soft delete fail with "new row
-- violates row level security policy" — the author cannot delete their own
-- comment. Do not narrow this to `deleted_at is null` without re-testing the
-- delete path.
-- ---------------------------------------------------------------------------
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
  for select using (
    public.can_read_trip(trip_id)
    and moderation_state <> 'blocked'
    and (
      (deleted_at is null and moderation_state in ('approved', 'pending'))
      or author_id = auth.uid()
    )
  );
