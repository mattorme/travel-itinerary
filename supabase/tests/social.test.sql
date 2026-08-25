begin;
select plan(18);

-- ---------------------------------------------------------------------------
-- Helpers, defined inside the transaction so they are rolled back with it.
-- See rls_trips.test.sql for why they are not a migration.
-- ---------------------------------------------------------------------------
create schema tests;

create function tests.authenticate_as(user_id uuid) returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$fn$;

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

-- author = b1, reader = b2, anonymous = b3
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'author@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b2', 'reader@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b3', '', true);

insert into public.trips (id, owner_id, slug, title, duration_days, visibility, status, moderation_state)
values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000b1',
        'social-trip', 'Social Trip', 3, 'public', 'ready', 'approved'),
       ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-0000000000b1',
        'hidden-trip', 'Hidden Trip', 3, 'private', 'ready', 'pending');

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');

select lives_ok(
  $$ insert into public.follows (follower_id, followee_id)
     values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b1') $$,
  'a registered user can follow another registered user');

select is(
  (select follower_count from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  1, 'the followee gains a follower');
select is(
  (select following_count from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
  1, 'the follower gains a following');

select throws_ok(
  $$ insert into public.follows (follower_id, followee_id)
     values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b2') $$,
  '23514', null,
  'nobody can follow themselves');

select throws_ok(
  format($$ insert into public.follows (follower_id, followee_id) values (%L, %L) $$,
         '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'),
  '42501', null,
  'a client cannot forge a follow on behalf of somebody else');

-- Anonymous accounts stay out of the social graph in both directions.
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b3');

select throws_ok(
  $$ insert into public.follows (follower_id, followee_id)
     values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'an anonymous account cannot follow anyone');

reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ insert into public.follows (follower_id, followee_id)
     values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3') $$,
  '42501', null,
  'an anonymous account cannot be followed');

delete from public.follows where follower_id = '00000000-0000-0000-0000-0000000000b2';
select is(
  (select follower_count from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'unfollowing decrements the counter');

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.comments (trip_id, author_id, body)
     values ('44444444-4444-4444-4444-444444444444',
             '00000000-0000-0000-0000-0000000000b2', 'Went last year, this is right.') $$,
  'a registered user can comment on a public trip');

-- Nothing reaches an indexable page without going through moderation first.
select is(
  (select moderation_state::text from public.comments
    where author_id = '00000000-0000-0000-0000-0000000000b2'),
  'pending', 'a new comment is held for moderation');

select throws_ok(
  $$ insert into public.comments (trip_id, author_id, body, moderation_state)
     values ('44444444-4444-4444-4444-444444444444',
             '00000000-0000-0000-0000-0000000000b1', 'Not mine', 'approved') $$,
  '42501', null,
  'a client cannot post as somebody else');

update public.comments set moderation_state = 'approved'
 where author_id = '00000000-0000-0000-0000-0000000000b2';
select is(
  (select moderation_state::text from public.comments
    where author_id = '00000000-0000-0000-0000-0000000000b2'),
  'pending', 'a commenter cannot approve their own comment');

select is(
  (select comment_count from public.trips where slug = 'social-trip'),
  1, 'the trip comment count was incremented');

-- Anonymous accounts cannot comment: there has to be somebody accountable
-- behind text that appears on a public page.
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b3');
select throws_ok(
  $$ insert into public.comments (trip_id, author_id, body)
     values ('44444444-4444-4444-4444-444444444444',
             '00000000-0000-0000-0000-0000000000b3', 'anon comment') $$,
  '42501', null,
  'an anonymous account cannot comment');

select is(
  (select count(*)::int from public.comments
    where trip_id = '55555555-5555-5555-5555-555555555555'),
  0, 'comments on a private trip are invisible');

-- Soft delete decrements without removing the row.
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
update public.comments set deleted_at = now()
 where author_id = '00000000-0000-0000-0000-0000000000b2';

reset role;
select is(
  (select comment_count from public.trips where slug = 'social-trip'),
  0, 'soft-deleting a comment decrements the count');

select is(
  (select count(*)::int from public.comments
    where author_id = '00000000-0000-0000-0000-0000000000b2'),
  1, 'the soft-deleted row survives for audit');

-- The public thread reader must not surface it, author or otherwise.
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from public.trip_comments('44444444-4444-4444-4444-444444444444')),
  0, 'a deleted comment is gone from the public thread, even for its author');

select * from finish();
rollback;
