-- ============================================================================
-- Identity: profiles are the publicly-joinable surface over auth.users.
-- auth.users holds PII (email). profiles must never contain it.
-- ============================================================================

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          extensions.citext not null unique,
  display_name      text,
  avatar_url        text,
  bio               text check (char_length(bio) <= 400),
  country_code      char(2),
  subscription_tier public.subscription_tier not null default 'free',
  is_public         boolean not null default true,
  is_anonymous      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint username_format check (username ~ '^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])$')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision a profile for every new auth user, including anonymous ones.
-- Username collisions are resolved by suffixing; the loop is bounded.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_name text;
  candidate text;
  attempt   int := 0;
  is_anon   boolean;
begin
  is_anon := coalesce(new.is_anonymous, false);

  base_name := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9_]', '', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'traveller';
  end if;
  base_name := left(base_name, 20);

  candidate := base_name;
  loop
    exit when not exists (select 1 from public.profiles p where p.username = candidate);
    attempt := attempt + 1;
    exit when attempt > 20;
    candidate := base_name || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;

  if attempt > 20 then
    candidate := 'traveller' || substr(md5(new.id::text), 1, 12);
  end if;

  insert into public.profiles (id, username, display_name, avatar_url, is_anonymous, is_public)
  values (
    new.id,
    candidate,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    is_anon,
    not is_anon
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anonymous users who later link a real identity should stop being flagged anonymous.
create or replace function public.handle_user_upgraded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    update public.profiles
       set is_anonymous = false,
           is_public    = true
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_upgraded
  after update of is_anonymous on auth.users
  for each row execute function public.handle_user_upgraded();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_read_public on public.profiles
  for select using (is_public or id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- No insert/delete policy: profiles are created by trigger and removed by user cascade.

-- ---------------------------------------------------------------------------
-- RLS cannot express column-level permissions, and `profiles_update_own` would
-- otherwise let a user grant themselves `subscription_tier = 'pro'`.
-- Protected columns are pinned unless the caller is the service role.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: the guard needs to observe the CALLER's
-- database role. As SECURITY DEFINER, current_user would always be the
-- function owner and the guard would never fire.
create or replace function public.guard_profile_columns()
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
    new.subscription_tier := old.subscription_tier;
    new.is_anonymous      := old.is_anonymous;
    new.created_at        := old.created_at;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();
