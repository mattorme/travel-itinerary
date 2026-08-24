-- ============================================================================
-- Operations: generation jobs, the cost ledger, FX.
-- These tables are how you answer "what does a trip cost us" and "is quality
-- regressing". Without them every cost decision is a guess.
-- ============================================================================

create table public.generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  status        public.job_status not null default 'queued',
  stage         text,
  progress      numeric(4,3) not null default 0,
  stage_history jsonb not null default '[]'::jsonb,
  input         jsonb not null,
  error         jsonb,
  attempt       integer not null default 1,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint generation_jobs_progress_range check (progress between 0 and 1)
);

create index generation_jobs_trip_idx      on public.generation_jobs (trip_id, created_at desc);
create index generation_jobs_requester_idx on public.generation_jobs (requester_id, created_at desc);
create index generation_jobs_active_idx    on public.generation_jobs (status, created_at)
  where status in ('queued', 'running');

create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Unit-economics ledger. One row per model call and one per external API call.
-- ---------------------------------------------------------------------------
create table public.ai_generations (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid references public.generation_jobs(id) on delete set null,
  trip_id           uuid references public.trips(id) on delete set null,
  stage             text not null,
  provider          text not null default 'openai',
  model             text not null,
  input_tokens      integer not null default 0,
  output_tokens     integer not null default 0,
  cached_tokens     integer not null default 0,
  reasoning_tokens  integer not null default 0,
  cost_usd          numeric(10,6) not null default 0,
  latency_ms        integer,
  ok                boolean not null default true,
  error_code        text,
  created_at        timestamptz not null default now()
);
create index ai_generations_job_idx  on public.ai_generations (job_id);
create index ai_generations_cost_idx on public.ai_generations (created_at desc);

create table public.api_usage (
  id         uuid primary key default gen_random_uuid(),
  provider   public.api_provider not null,
  sku        text not null,
  units      integer not null default 1,
  cost_usd   numeric(10,6) not null default 0,
  trip_id    uuid references public.trips(id) on delete set null,
  job_id     uuid references public.generation_jobs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index api_usage_day_idx  on public.api_usage (created_at desc);
create index api_usage_trip_idx on public.api_usage (trip_id) where trip_id is not null;

-- Spend ceiling: read by the kill switch before any generation is admitted.
create or replace function public.spend_today_usd()
returns numeric
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select sum(cost_usd) from public.api_usage      where created_at >= date_trunc('day', now())), 0
  ) + coalesce(
    (select sum(cost_usd) from public.ai_generations where created_at >= date_trunc('day', now())), 0
  );
$$;

-- ---------------------------------------------------------------------------
create table public.fx_rates (
  base  char(3) not null,
  quote char(3) not null,
  as_of date    not null,
  rate  numeric(18,8) not null,
  primary key (base, quote, as_of)
);

-- ---------------------------------------------------------------------------
-- RLS: operational tables are service-role only, except a requester may watch
-- their own job (this is what drives the Realtime progress subscription).
-- ---------------------------------------------------------------------------
alter table public.generation_jobs enable row level security;
alter table public.ai_generations  enable row level security;
alter table public.api_usage       enable row level security;
alter table public.fx_rates        enable row level security;

create policy generation_jobs_read_own on public.generation_jobs
  for select using (requester_id = auth.uid() or public.can_read_trip(trip_id));

create policy fx_rates_read on public.fx_rates for select using (true);

-- ai_generations and api_usage have no policies: service role only. Cost data
-- is not something a user should be able to enumerate.

-- Realtime: the client subscribes to its own generation job row.
alter publication supabase_realtime add table public.generation_jobs;
alter publication supabase_realtime add table public.trip_days;
