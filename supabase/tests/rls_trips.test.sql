begin;
select plan(29);

-- ---------------------------------------------------------------------------
-- Test helpers, defined inside the test transaction so they are rolled back
-- with it. They set `request.jwt.claims`, which is how RLS decides who you are
-- — shipping them as a migration would be an impersonation hole in production.
--
-- Every impersonation is preceded by `reset role`: once the session is
-- SET ROLE authenticated it no longer has rights on this schema.
-- ---------------------------------------------------------------------------
create schema tests;

create function tests.authenticate_as(user_id uuid) returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$fn$;

create function tests.authenticate_as_anon() returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
end;
$fn$;

-- Mirrors what GoTrue inserts, so the profile trigger fires exactly as in prod.
create function tests.create_user(uid uuid, email text, anon boolean default false)
returns uuid language plpgsql as $fn$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_anonymous
  ) values (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    case when anon then null else email end, '',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb, anon
  );
  return uid;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Fixtures. Fixed UUIDs so no lookup table is needed once we drop to a
-- non-superuser role.
--   owner = 0...a1, other = 0...a2, anon user = 0...a3
-- ---------------------------------------------------------------------------
select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'owner@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a2', 'other@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a3', '', true);

-- Scoped to the fixture users, not a global count: the seed file also creates
-- rows, and a test that breaks when someone adds seed data is testing the wrong
-- thing.
select is(
  (select count(*)::int from public.profiles
    where id in ('00000000-0000-0000-0000-0000000000a1',
                 '00000000-0000-0000-0000-0000000000a2',
                 '00000000-0000-0000-0000-0000000000a3')),
  3,
  'a profile is auto-provisioned for every auth user, including anonymous ones');

select is((select is_anonymous from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  true, 'anonymous users are flagged on their profile');

select isnt(
  (select username from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  (select username from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  'usernames are unique across users');

insert into public.trips (id, owner_id, slug, title, duration_days, visibility, status)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', 'private-trip',  'Private Trip',  5, 'private',  'ready'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000a1', 'unlisted-trip', 'Unlisted Trip', 5, 'unlisted', 'ready'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000a1', 'public-trip',   'Public Trip',   5, 'public',   'ready');

update public.trips set moderation_state = 'approved' where slug in ('public-trip', 'unlisted-trip');

insert into public.trip_days (id, trip_id, day_index, title) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'Day 1 private'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 1, 'Day 1 public');

insert into public.activities (trip_day_id, order_index, title, custom_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'Secret activity', 'Secret activity'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 1, 'Public activity', 'Public activity');

-- ---------------------------------------------------------------------------
-- Owner sees everything of theirs
-- ---------------------------------------------------------------------------
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*)::int from public.trips where owner_id = '00000000-0000-0000-0000-0000000000a1'),
  3, 'owner sees all three of their trips');
select is(
  (select count(*)::int from public.activities a
     join public.trip_days d on d.id = a.trip_day_id
     join public.trips t on t.id = d.trip_id
    where t.owner_id = '00000000-0000-0000-0000-0000000000a1'),
  2, 'owner sees activities on all their trips');

-- ---------------------------------------------------------------------------
-- A second user sees only public + unlisted
-- ---------------------------------------------------------------------------
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a2');

select is((select count(*)::int from public.trips where slug = 'private-trip'), 0,
  'a private trip is invisible to another user');
select is((select count(*)::int from public.trips where slug = 'unlisted-trip'), 1,
  'an unlisted trip is reachable by another user who has the link');
select is((select count(*)::int from public.trips where slug = 'public-trip'), 1,
  'a public trip is visible to another user');
select is(
  (select count(*)::int from public.activities a
     join public.trip_days d on d.id = a.trip_day_id
     join public.trips t on t.id = d.trip_id
    where t.owner_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'child rows of a private trip are invisible to another user');
select is(
  (select count(*)::int from public.trip_days d
     join public.trips t on t.id = d.trip_id
    where t.owner_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'trip_days of a private trip are invisible to another user');

-- RLS makes a non-matching UPDATE a no-op rather than an error. Both facts matter:
-- the statement succeeds (so it cannot be used to probe existence) and changes nothing.
update public.trips set title = 'Hijacked' where slug = 'public-trip';
select is((select title from public.trips where slug = 'public-trip'), 'Public Trip',
  'another user cannot update someone else''s trip');

select throws_ok(
  $$ insert into public.trips (owner_id, slug, title, duration_days)
     values ('00000000-0000-0000-0000-0000000000a1', 'forged', 'Forged', 3) $$,
  '42501', null,
  'a client cannot insert a trip owned by someone else');

-- ---------------------------------------------------------------------------
-- Logged-out visitor
-- ---------------------------------------------------------------------------
reset role;
select tests.authenticate_as_anon();

select is((select count(*)::int from public.trips where slug = 'private-trip'), 0,
  'a logged-out visitor cannot see a private trip');
select is((select count(*)::int from public.trips where slug = 'public-trip'), 1,
  'a logged-out visitor can see a public trip');

-- ---------------------------------------------------------------------------
-- Column guards: counters, featuring, indexability and tier are system-owned
-- ---------------------------------------------------------------------------
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');

update public.trips
   set like_count = 9999, is_featured = true, quality_score = 99
 where slug = 'public-trip';

select is((select like_count from public.trips where slug = 'public-trip'), 0,
  'an owner cannot inflate their own like_count');
select is((select is_featured from public.trips where slug = 'public-trip'), false,
  'an owner cannot feature their own trip');
select is((select quality_score from public.trips where slug = 'public-trip'), 0::numeric,
  'an owner cannot set their own quality score');

update public.profiles set subscription_tier = 'pro'
 where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select subscription_tier::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'free', 'a user cannot upgrade their own subscription tier');

-- ---------------------------------------------------------------------------
-- Cloning
-- ---------------------------------------------------------------------------
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a2');

select lives_ok(
  $$ select public.clone_trip('33333333-3333-3333-3333-333333333333') $$,
  'a second user can clone a public trip');

-- clone_trip is SECURITY DEFINER, so it can see the row; the explicit
-- authorisation check inside it is what refuses. That check is the reason the
-- function does not simply trust RLS.
select throws_ok(
  $$ select public.clone_trip('11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'clone_trip refuses a private trip belonging to someone else');

reset role;

select is(
  (select count(*)::int from public.trip_clones
    where source_trip_id = '33333333-3333-3333-3333-333333333333'),
  1, 'the clone edge was recorded');
select is((select clone_count from public.trips where slug = 'public-trip'), 1,
  'the source trip clone_count was incremented');
select is(
  (select t.visibility::text from public.trips t
     join public.trip_clones c on c.cloned_trip_id = t.id
    where c.source_trip_id = '33333333-3333-3333-3333-333333333333'),
  'private', 'a clone is born private, never inheriting the source visibility');
select is(
  (select t.origin_creator_username from public.trips t
     join public.trip_clones c on c.cloned_trip_id = t.id
    where c.source_trip_id = '33333333-3333-3333-3333-333333333333'),
  (select username::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'attribution to the original creator is denormalised onto the clone');
select is(
  (select t.root_trip_id from public.trips t
     join public.trip_clones c on c.cloned_trip_id = t.id
    where c.source_trip_id = '33333333-3333-3333-3333-333333333333'),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'the clone points at the root of the fork tree');
select is(
  (select count(*)::int from public.activities a
     join public.trip_days d on d.id = a.trip_day_id
     join public.trip_clones c on c.cloned_trip_id = d.trip_id
    where c.source_trip_id = '33333333-3333-3333-3333-333333333333'),
  1, 'activities were deep-copied into the clone');

-- ---------------------------------------------------------------------------
-- reorder_activities: SECURITY DEFINER, so its own authorisation must hold
-- ---------------------------------------------------------------------------
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a2');

select throws_ok(
  $$ select public.reorder_activities(
       'aaaaaaaa-0000-0000-0000-000000000002',
       array['00000000-0000-0000-0000-000000000000']::uuid[]) $$,
  '42501', null,
  'reorder_activities refuses a day on a trip the caller does not own');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');

select throws_ok(
  $$ select public.reorder_activities(
       'aaaaaaaa-0000-0000-0000-000000000002',
       array[]::uuid[]) $$,
  '22023', null,
  'reorder_activities refuses an ordering that omits activities');

select throws_ok(
  $$ select public.reorder_activities(
       'aaaaaaaa-0000-0000-0000-000000000002',
       array['aaaaaaaa-0000-0000-0000-000000000009']::uuid[]) $$,
  '22023', null,
  'reorder_activities refuses an activity belonging to another day');

select * from finish();
rollback;
