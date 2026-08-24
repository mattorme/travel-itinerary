-- ============================================================================
-- Extensions and enum types
-- ============================================================================

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "citext"    with schema extensions;
create extension if not exists "pg_trgm"   with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.destination_kind    as enum ('city', 'region', 'country');
create type public.trip_status         as enum ('draft', 'generating', 'ready', 'failed');
create type public.trip_visibility     as enum ('private', 'unlisted', 'public');
create type public.date_mode           as enum ('exact', 'flexible');
create type public.travel_style        as enum ('budget', 'backpacker', 'mid_range', 'balanced', 'luxury');
create type public.trip_pace           as enum ('relaxed', 'balanced', 'packed');
create type public.transport_mode      as enum ('walking', 'transit', 'driving', 'rideshare', 'cycling', 'mixed');
create type public.accommodation_kind  as enum ('hostel', 'budget_hotel', 'hotel', 'apartment', 'boutique', 'resort', 'luxury');
create type public.activity_kind       as enum ('activity', 'meal', 'transit', 'accommodation', 'free_time');
create type public.activity_source     as enum ('generated', 'user_added', 'cloned');
create type public.cost_basis          as enum ('modelled', 'user', 'source');
create type public.subscription_tier   as enum ('free', 'pro');
create type public.moderation_state    as enum ('pending', 'approved', 'flagged', 'blocked');
create type public.job_status          as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.trip_event_type     as enum ('view', 'share', 'og_render', 'cta_click', 'clone_start');
create type public.api_provider        as enum ('openai', 'google_places', 'google_routes', 'google_photos', 'images');
create type public.signal_source       as enum ('behavioural', 'editorial');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
