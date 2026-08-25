# Architecture Proposal — AI Travel Itinerary Social Platform

Status: **proposal, awaiting approval**. Nothing implemented yet.

---

## 0. Executive summary

The spec is strong and the product thesis is right: the itinerary is the social object, the
public page is acquisition, cloning is retention. Six things in it need to change before any
code is written, and one of them is a hard legal/technical constraint rather than a preference.

1. **Google's Places terms forbid persistently storing place content.** You may store
   `place_id` forever; almost everything else (name, rating, hours, photos, coordinates) is
   cache-with-TTL only. The product's core artefact is a page that must render forever. This
   drives the whole data model. See §3.
2. **The LLM should never emit a place name.** It emits *slot → place_id* assignments chosen
   from a server-supplied candidate set. This structurally eliminates hallucinated venues,
   cuts token cost by ~10x, and makes validation trivial. See §6.
3. **Most of the pipeline should not be an LLM at all.** Ranking, sequencing, routing, costing
   and repair are deterministic problems. Reserve the LLM for the two things it's actually good
   at: deciding *what kind* of day this should be, and writing the narrative. See §6.
4. **Generation must be a job, not a request.** A 7-day itinerary is 60–120s of work. Holding an
   HTTP connection open for that is fragile and unresumable. Use a job row + Supabase Realtime
   for progress. It's less code than SSE and gives resumability for free. See §7.
5. **Google gives you price *levels*, not prices.** Every cost figure in the product is
   *modelled*, not sourced. This needs an explicit, owned cost model and honest UI labelling.
   The spec assumes cost data exists. It does not. See §9.
6. **Indexing every generated itinerary will get the domain demoted.** Thousands of near-duplicate
   AI-written "5 days in Tokyo" pages is textbook scaled-content abuse. Trips must earn
   indexability. See §12.

Plus one product change: **cut follows, comments and the social feed from the MVP entirely.**
They are worthless at zero users and they are not the loop. The loop is share → view → clone.

---

## 1. Architectural risks, ranked

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Places ToS prohibits durable storage of place content; public pages must render forever | **Critical** | Split `places` (permanent, `place_id` only) from `place_cache` (30-day TTL, lazily rehydrated). §3 |
| 2 | Unit economics: naive pipeline costs $2–5/trip in Google + OpenAI calls | **Critical** | Shared per-destination place corpus; deterministic ranking; single route matrix per day; budget kill switch. §10 |
| 3 | Anonymous free generation = an unauthenticated money faucet | **Critical** | Turnstile + Supabase anonymous auth + per-identity quota + global daily spend cap. §11 |
| 4 | Generation latency (60–120s) kills conversion | High | Job + Realtime progress; stream *days* as they complete so day 1 renders in ~8s. §7 |
| 5 | Itinerary quality is the entire product and is the hardest part | High | Deterministic geographic sequencing + validation + golden-fixture eval harness. §8 |
| 6 | SEO: mass AI pages trigger scaled-content demotion | High | `noindex` by default; earn indexability; curated destination hubs as the real SEO asset. §12 |
| 7 | RLS mistakes leak private trips | High | `security definer` read-predicate helper, pgTAP tests as a merge gate. §5 |
| 8 | OpenAI strict-mode JSON Schema ≠ idiomatic Zod (no optionals, no unions, all keys required) | Medium | Separate *wire* schemas from *domain* schemas with an explicit mapping layer. §6.4 |
| 9 | Cloning semantics under later edits / deletion / privacy changes | Medium | Clone = deep snapshot at version N; attribution degrades gracefully. §13 |
| 10 | Counter hot-rows (`view_count`) under viral load | Medium | Append-only `trip_events` + periodic rollup, not synchronous `UPDATE`. §4 |
| 11 | Vendor lock-in to OpenAI/Google | Low | Thin interfaces only. Do **not** build a provider plugin system. §10.5 |

---

## 2. What I'd change in the specification

**Remove from MVP**

- **Follows, comments, social feed, creator profiles beyond a username page.** Zero value at zero
  users, and each is a moderation surface. Schema stubs only.
- **`trip_collaborators`.** Multiplayer editing is a different product with different concurrency
  requirements (CRDT/OT or last-write-wins with presence). Don't half-build it.
- **Supabase Edge Functions.** You'd be splitting the codebase across two runtimes (Deno + Node)
  and duplicating types for no gain — everything server-side already lives in Next.js route
  handlers on Vercel. Use Edge Functions only for things that must be adjacent to the DB
  (`pg_cron`-triggered maintenance). Webhooks and generation stay in Next.js.
- **Stripe.** Agreed — defer. But put `subscription_tier` on `profiles` and route every
  generation through an `entitlements.check()` from day 1, so gating is a config change later.

**Change**

- **URL strategy.** The spec proposes both `/itineraries/japan/12-days` and
  `/trips/japan-12-days-tokyo-kyoto-osaka` for the same content — that's self-inflicted duplicate
  content. Collapse to:
  - `/t/[slug]` — the canonical shareable trip page (short, pasteable, the thing that spreads).
  - `/destinations/[country]/[city]` and `/destinations/[city]/[n]-days` — curated *collection*
    pages that link to trips. These are the SEO asset, not individual trips.
- **"Estimated cost" is modelled, not fetched.** Label it as an estimate in the UI, own the model,
  and make it destination-calibrated. See §9.
- **Free-form itinerary editing → command-based editing.** A generic JSON PATCH endpoint means
  every invariant (no overlaps, travel times consistent, costs summed) can be violated by the
  client. Expose `moveActivity`, `replaceActivity`, `removeActivity`, `addActivity`, `retimeDay`,
  `lockActivity`. Each re-runs local validation and recomputes only affected legs.
- **Progress messages should be real, not theatrical.** "Optimising your route…" while nothing is
  happening is the thing users notice and resent. Drive the copy from actual job stages.

**Add (missing from the spec)**

- **Accommodation anchor.** The spec collects accommodation *preferences* but the data model has
  nowhere to put a hotel. This matters enormously: the base location determines every day's
  geographic cluster and first/last leg. MVP: a per-city anchor (neighbourhood or specific hotel),
  used for routing and as a nightly budget line. No booking.
- **Timezones and opening hours are date-dependent.** Validating "is the museum open" needs the
  destination's IANA timezone, day-of-week, and ideally public holidays. Store `timezone` on
  `destinations`.
- **Currency and FX.** Budget in AUD, cost model calibrated in USD. Need a daily FX snapshot table
  and a display-currency preference. Don't do live FX per render.
- **Content moderation.** User-authored titles and notes on publicly indexable pages need a
  moderation pass (cheap classifier on publish) and a report flow. This is a launch blocker for
  public pages, not a nice-to-have.
- **Image rights.** Google Place Photos are billed per fetch and can't be copied into your
  storage. Hero images and share cards need a different source. See §3.3.
- **Attribution.** Displaying Places content without a Google map legally requires visible Google
  attribution. Bake it into the activity card component so it can't be forgotten.
- **Anonymous → account claim.** Use Supabase **anonymous sign-in** so anon users have a real
  `auth.uid()`; linking an identity on signup is then built-in and RLS is uniform. Much better
  than a hand-rolled cookie + claim-token flow.

---

## 3. The Google Places constraint (the one that shapes everything)

Verified against current Google docs (Aug 2026):

- Places content **must not** be pre-fetched, cached or stored, **except** that `place_id` is
  explicitly exempt and may be stored indefinitely. Narrow exceptions allow temporary caching of
  certain fields for up to 30 consecutive days.
- Text Search / Place Details are billed by **field-mask tier** (Essentials → Pro → Enterprise).
  You are billed at the *highest* tier any requested field belongs to. Requesting
  `displayName` alone escalates a request from Essentials to Pro; requesting opening hours
  escalates it further. Field masks are a first-class cost lever, not a detail.
- Route Matrix is billed **per element** (origins × destinations), capped at 625 elements
  (100 for `TRANSIT` or `TRAFFIC_AWARE_OPTIMAL`), 3,000 elements/minute.
- Attribution is mandatory when Places content is shown without a Google map.

### 3.1 Consequence for the data model

A trip stored in our DB has two kinds of content and they must be physically separated:

**Ours, permanent:**
- The plan itself — which slot, what time, what order, why.
- All narrative — day titles, summaries, the trip story, user notes and edits.
- The `place_id` reference.

**Google's, ephemeral:**
- Display name, address, coordinates, rating, review count, price level, opening hours,
  website, photo references, editorial summary.

So: `places` holds `(id, google_place_id, destination_id, created_at)` permanently.
`place_cache` holds the display payload with `expires_at = fetched_at + 30 days`.
Rendering a trip page is a **hydration**: fetch the plan (ours) + join fresh cache rows, and
lazily re-fetch any that are stale.

### 3.2 Why this is actually good

Rehydration is amortised across every trip that references the place. The 500 most-used places in
Tokyo get refreshed once per month regardless of whether 10 or 10,000 trips reference them. The
per-trip marginal Places cost for a warm destination approaches zero — see §10.

It also means place data is always *current*. A restaurant that closed shows as closed rather than
sitting in an itinerary forever.

### 3.3 Photos — as built

Google Place Photos are billed per fetch and cannot be copied into our storage. Using them as the
hero on a viral public page would mean paying per pageview, and every link preview any chat app
generates would bill us again.

Three tiers, in `lib/images/` and `app/api/place-photo/`:

| Surface | Source | Why |
|---|---|---|
| Hero, cards, OG image | Unsplash, hotlinked | Free, licensable, cacheable by the CDN, and their terms *require* hotlinking rather than re-hosting |
| Activity cards | Google Place Photos via `/api/place-photo/[placeId]` | The one place a photo of the actual venue is worth a billed fetch. Proxied so the server key stays server-side and an expired `place_cache` row stops resolving automatically |
| Everything, always | Generated cover art (`components/ui/cover-art.tsx`) | Deterministic SVG. No key, no network, no cost, no layout shift, renders before JS |

The Unsplash guidelines are load-bearing, not decorative: hotlink the returned URLs, attribute the
photographer and Unsplash with utm-tagged links, and hit `links.download_location` when a photo is
actually used. All three are implemented in `lib/images/unsplash.ts` and the credit line renders
inside `<Cover>` so a caller cannot forget it.

The generated fallback matters more than it sounds. Without an Unsplash key — and for any
destination nobody has curated — a grey box would make the acquisition page look broken. Instead
every trip gets a deterministic topographic cover with a dotted route across it, seeded from the
slug, in one of six palettes. It is the same visual language as the map, and it reads as designed
rather than missing.

> **Flag:** I've read the developer policy pages, not the full Maps Platform Service Specific
> Terms, and "how long may a consumer app cache place names" is a question people answer
> differently. The architecture above is the conservative reading and costs nothing extra to
> follow. If you want to store display names durably, that's a question for a lawyer, not for me
> — and the design here means changing that decision later is a one-table change.

---

## 4. Database schema

PostgreSQL, UUIDv7 primary keys (`gen_random_uuid()` is fine but v7 gives index locality),
`timestamptz` everywhere, `deleted_at` soft deletes on user-visible content.

### Identity
```
profiles              id (= auth.users.id), username citext unique, display_name, avatar_url,
                      bio, country_code, subscription_tier, is_public, created_at, updated_at
```
No email, ever. `auth.users` holds PII; `profiles` is the publicly-joinable surface.

### Geography and places
```
destinations          id, slug unique, name, kind (city|region|country), country_code,
                      parent_id -> destinations, lat, lng, timezone (IANA), bbox,
                      google_place_id, cost_index numeric, hero_image_url, hero_credit,
                      is_curated bool, created_at

places                id, google_place_id unique, destination_id, primary_type,
                      types text[], created_at
                      -- permanent, ID-only. No Google content.

place_cache           place_id PK, payload jsonb, display_name, formatted_address,
                      lat, lng, rating, user_rating_count, price_level, price_range jsonb,
                      opening_hours jsonb, website_uri, google_maps_uri, photo_names text[],
                      business_status, fetched_at, expires_at
                      -- TTL-bounded. Never joined into anything durable.

place_signals         place_id, tag, score, source (behavioural|editorial), updated_at
                      -- OUR signal: clone rate, save rate, manual curation. Not Google-derived.

route_legs            origin_place_id, dest_place_id, mode, depart_bucket,
                      duration_s, distance_m, fetched_at, expires_at
                      PK (origin_place_id, dest_place_id, mode, depart_bucket)
```

### Trips
```
trips                 id, owner_id -> profiles (nullable during anon), slug unique,
                      title, subtitle, status (draft|generating|ready|failed),
                      visibility (private|unlisted|public),
                      start_date, end_date, duration_days, date_mode (exact|flexible),
                      party jsonb {adults, children:[ages]}, currency char(3),
                      budget_total, budget_daily, estimated_cost_total, estimated_cost_breakdown jsonb,
                      travel_style, pace, interests text[], transport_modes text[],
                      food_prefs text[], accommodation_pref, user_notes text,
                      hero_image_url, hero_credit,
                      forked_from_trip_id -> trips, forked_from_version int, root_trip_id -> trips,
                      version int default 1,
                      like_count, save_count, view_count, clone_count, share_count int default 0,
                      quality_score numeric, is_indexable bool default false, is_featured bool,
                      moderation_state (pending|approved|flagged|blocked),
                      published_at, created_at, updated_at, deleted_at

trip_destinations     trip_id, destination_id, order_index, first_day_index, nights,
                      anchor_place_id -> places (accommodation anchor, nullable)

trip_days             id, trip_id, day_index, date, title, summary,
                      destination_id, estimated_cost, notes
                      UNIQUE (trip_id, day_index)

activities            id, trip_day_id, order_index,
                      kind (activity|meal|transit|accommodation|free_time),
                      place_id -> places NULL, custom_name text NULL,
                      title, description,              -- ours, authored
                      start_time time, end_time time, duration_minutes int,
                      estimated_cost numeric, cost_basis (modelled|user|source),
                      inbound_travel jsonb {mode, minutes, meters, polyline},
                      booking_url, is_locked bool, source (generated|user_added|cloned),
                      created_at, updated_at
                      UNIQUE (trip_day_id, order_index) DEFERRABLE INITIALLY DEFERRED
```
`activities.title`/`description` are authored text (ours) and always render, even with a cold
`place_cache`. A trip page is never blank because Google is down.

### Social
```
trip_likes            (trip_id, profile_id) PK, created_at
trip_saves            (trip_id, profile_id) PK, created_at
trip_clones           id, source_trip_id, cloned_trip_id unique, cloner_id,
                      source_version int, created_at
trip_events           id, trip_id, event_type (view|share|og_render|cta_click),
                      actor_hash, channel, referrer_host, country, created_at
                      -- append-only, monthly partitions
follows               (follower_id, followee_id) PK      -- schema now, feature later
comments              id, trip_id, author_id, body, parent_id, moderation_state, created_at
```
One `trip_events` table rather than separate `trip_views`/`trip_shares` — same shape, same access
pattern, one rollup job.

Counters on `trips` are denormalised. Likes and saves update synchronously via trigger (low
volume, needs to feel instant). Views and shares roll up from `trip_events` on a schedule —
a synchronous `UPDATE trips SET view_count = view_count + 1` on a trending trip is a guaranteed
lock convoy.

### Operations
```
generation_jobs       id, trip_id, requester_id, status, stage, progress numeric,
                      stage_history jsonb[], input jsonb, error jsonb,
                      started_at, finished_at, created_at

ai_generations        id, job_id, trip_id, stage, provider, model,
                      input_tokens, output_tokens, cached_tokens, reasoning_tokens,
                      cost_usd, latency_ms, ok, error_code, created_at

api_usage             id, provider (google_places|google_routes|openai|images),
                      sku, units int, cost_usd, trip_id, created_at

fx_rates              (base, quote, as_of) PK, rate
```
`ai_generations` + `api_usage` are the unit-economics ledger. Without them you cannot answer
"what does a trip cost us" and every cost decision is a guess.

### Indexes worth having on day one
```
trips (slug) unique
trips (owner_id, updated_at desc) where deleted_at is null
trips (published_at desc) where visibility='public' and deleted_at is null
trips (quality_score desc) where is_indexable and visibility='public'
trips using gin (interests)
trip_days (trip_id, day_index)
activities (trip_day_id, order_index)
places (google_place_id) unique
places (destination_id, primary_type)
place_cache (expires_at) where expires_at < now()   -- refresh queue
trip_events (trip_id, created_at desc)
```

---

## 5. Authentication and authorisation

**Auth:** Supabase Auth. Email OTP (magic link) + Google OAuth. No password forms at launch —
fewer support tickets, fewer breach vectors, higher conversion.

**Anonymous users:** Supabase anonymous sign-in. An anon visitor gets a real JWT and a real
`auth.uid()`, so `trips.owner_id` is never null and RLS is uniform for anon and registered users.
On signup the anonymous user is upgraded in place — their trip is already theirs, no claim flow,
no orphan rows.

**Sessions:** `@supabase/ssr`, cookie-based, refreshed in middleware. Three clients:
- `lib/db/supabase/server.ts` — RLS-bound, request-scoped, used by RSCs and route handlers.
- `lib/db/supabase/browser.ts` — RLS-bound, used only for Realtime subscriptions.
- `lib/db/supabase/admin.ts` — service role. `import 'server-only'` at the top. Used only by the
  generation worker, rollup jobs and webhooks. Never imported from a component.

**Authorisation is two-layer:**
1. **RLS is the backstop.** Correctness guarantee. Assume every other layer is buggy.
2. **Explicit server-side checks in mutations** (`assertCanEdit(tripId, user)`), because RLS
   returns "0 rows" where users need "you don't have permission" or "this trip is private".

Ownership is **never** read from the request body. Every mutation derives identity from the
session and writes `owner_id` server-side.

**RLS shape** — the important detail is a `security definer stable` predicate so child tables
don't re-evaluate the parent policy per row:

```sql
create function public.can_read_trip(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from trips
    where id = t and deleted_at is null
      and (visibility in ('public','unlisted') or owner_id = auth.uid())
  );
$$;

create policy trip_days_read on trip_days for select using (can_read_trip(trip_id));
```

Write policies are strictly `owner_id = auth.uid()`. Counter increments happen through
`security definer` RPCs with their own rate limiting, never through a table grant.

`profiles` exposes only public columns and only where `is_public` — a public trip shows a
username and avatar, nothing else.

**Testing:** pgTAP suite asserting, as three different JWTs (anon / owner / other user), that
private trips are invisible, that unlisted trips are reachable by slug but not by listing, and
that no write path accepts a client-supplied `owner_id`. This runs in CI as a merge gate.

---

## 6. AI generation architecture

### 6.1 The core move

**The LLM never writes a place name.** It receives a candidate set and returns
`{slot_id, place_id, reason}` where `place_id` must be drawn from the supplied set. The server
rejects any id outside the set.

This eliminates hallucinated restaurants *structurally* rather than by validation, cuts output
tokens by roughly an order of magnitude, and makes the "AI must not be the source of truth"
principle an invariant rather than an aspiration.

### 6.2 Pipeline

Deterministic stages marked **[D]**, LLM stages **[AI]**.

```
0. normalizeRequest         [D]   resolve destination -> destinations row, timezone, dates, party
1. planShape                [AI]  cheap model. Day themes, base city per day, ordered experience
                                  SLOTS: {slot_id, kind, tag, target_time, duration, rationale}.
                                  No place names. One call for the whole trip.
2. resolveCandidates        [D]   per (destination, tag): corpus first, Places API on miss.
                                  Field-masked to the cheapest tier that answers the question.
3. rankCandidates           [D]   Bayesian rating prior, interest match, price-level match,
                                  distance to the day's centroid, chain/type dedupe,
                                  cross-day novelty. Pure function, unit-testable.
4. assignPlaces             [AI]  strong model. Per day: shortlist in, slot->place_id out,
                                  plus a one-line reason. Schema-constrained to the shortlist.
5. sequenceDay              [D]   nearest-neighbour + 2-opt over <=10 nodes, subject to meal
                                  windows, opening hours, and pinned/locked activities.
6. computeRoutes            [D]   ONE computeRouteMatrix per day over the final <=10 nodes,
                                  cache-first against route_legs.
7. estimateCosts            [D]   owned cost model (§9).
8. validate                 [D]   pure -> ItineraryIssue[] (§8).
9. repair                   [D→AI] deterministic fixes first (retime, reorder, next-best swap).
                                  LLM only for semantic issues, scoped to one day.
10. writeNarrative          [AI]  cheap model. Trip summary, highlights, day titles.
                                  Runs in PARALLEL with 5-7.
11. persist                 [D]   slug, hero image, moderation pass, publish.
```

Per-day work in stages 4–9 is parallelised across days with a bounded concurrency limit, then
reconciled for cross-day duplicates.

### 6.3 Why not more LLM

Ranking, sequencing and repair are optimisation problems with objective functions. An LLM does
them worse, non-deterministically, and for money. Every stage moved out of the model makes the
product cheaper, faster, testable, and more consistent — and consistency is what makes an
itinerary feel like a planner made it rather than a slot machine.

### 6.4 Structured outputs: the Zod trap

OpenAI strict-mode JSON Schema is restrictive: every property must appear in `required`,
`additionalProperties` must be `false`, and many idiomatic Zod constructs (`.optional()`,
`.default()`, discriminated unions, refinements) either don't survive translation or silently
degrade. Naively piping a rich domain Zod schema into `zodTextFormat` is a known source of
"invalid schema for response_format" and, worse, of schemas that validate but don't constrain.

So: **two schema layers.**

- `domain/schemas/*` — rich Zod. Optionals, unions, refinements, branded IDs. The type source
  of truth for the app.
- `lib/ai/wire/*` — flat, strict-compatible schemas. No optionals (use nullable), no unions,
  no refinements, shallow nesting, short field names. Purpose-built per stage.
- An explicit `fromWire()` mapper per stage, itself unit-tested.

Wire schemas stay small on purpose: stage 4's output is an array of
`{slot_id, place_id, reason}`. That's the whole contract.

### 6.5 Provider abstraction

One interface, no plugin system:

```ts
interface LlmClient {
  generateStructured<T>(args: {
    schema: JsonSchema; parse: (raw: unknown) => T;
    system: string; input: string;
    tier: 'fast' | 'strong'; traceId: string; stage: string;
  }): Promise<{ value: T; usage: Usage }>;
}
```

`tier` rather than a model name at the call site, so model selection is one config table.
Every call writes an `ai_generations` row. Same pattern for `PlaceProvider` and `RouteProvider`
— narrow interfaces shaped by what the pipeline needs, not by what Google's API exposes.

### 6.6 Prompt injection

`user_notes` is free text that reaches the model. Treat it as data: fenced, explicitly labelled
untrusted in the system prompt, and — more importantly — structurally unable to cause harm,
because the model's only output authority is choosing IDs from a server-supplied list. It cannot
invent a place, a URL, or a booking link. Cloned public trips carry other users' authored text;
same treatment.

---

## 7. Generation as a job

```
POST /api/trips/generate
  -> validate + rate-limit + entitlement check
  -> create trips row (status='generating') + generation_jobs row
  -> enqueue work, return { tripId, jobId } immediately
Client
  -> navigates to /trips/{id} and subscribes to the generation_jobs row via Supabase Realtime
Worker
  -> runs the pipeline, writing stage/progress to the job row
  -> writes each trip_day as it completes
Client
  -> renders days as they land; day 1 visible in ~8s
```

Why a job rather than a streamed response:
- Survives a page refresh, a lost connection, a phone locking mid-generation.
- Progress is state in the DB, not an ephemeral stream, so it's observable and debuggable.
- Realtime subscription is less code than SSE plumbing plus reconnection handling.
- Decouples worker runtime limits from the request lifecycle.

Progress copy is derived from real stage transitions. If stage 2 takes 20s, the user sees
"Finding places you'll love" for 20s — because that's what's happening.

**Worker placement:** start on Vercel Functions with `waitUntil` and Fluid compute. If p95 pushes
past the platform ceiling, move the worker to a dedicated container and have Vercel enqueue only.
The job-row design means that migration touches one file.

---

## 8. Validation

Pure functions over the domain model, in `domain/validation/`, zero IO, exhaustively unit-tested
against golden fixtures. Each returns typed issues:

```ts
type IssueSeverity = 'error' | 'warning';
type ItineraryIssue =
  | { code: 'OVERLAP'; dayIndex: number; activityIds: [string, string] }
  | { code: 'CLOSED_AT_VISIT'; activityId: string; opens: string; closes: string }
  | { code: 'TRAVEL_TIME_IMPOSSIBLE'; fromId: string; toId: string; needS: number; haveS: number }
  | { code: 'GEOGRAPHIC_THRASH'; dayIndex: number; totalTravelMinutes: number }
  | { code: 'OVERPACKED'; dayIndex: number; activeMinutes: number; paceLimit: number }
  | { code: 'BUDGET_EXCEEDED'; overBy: number; pct: number }
  | { code: 'INTEREST_UNMET'; interest: string }
  | { code: 'DUPLICATE_PLACE'; placeId: string; dayIndexes: number[] }
  | { code: 'DURATION_MISMATCH'; expected: number; actual: number }
  | { code: 'MISSING_MEAL'; dayIndex: number; meal: 'lunch' | 'dinner' }
  | { code: 'UNKNOWN_PLACE'; placeId: string }
  | { code: 'IMPLAUSIBLE_MODE'; activityId: string; mode: string; distanceM: number };
```

**Repair is tiered.** Most issues have a deterministic fix and should never touch the model:

| Issue | Fix |
|---|---|
| `OVERLAP`, `OVERPACKED` | retime / drop lowest-ranked unlocked activity |
| `CLOSED_AT_VISIT` | shift within the day, or swap to next-best candidate with compatible hours |
| `GEOGRAPHIC_THRASH` | re-run 2-opt; if still bad, reassign the outlier to a day whose centroid is closer |
| `TRAVEL_TIME_IMPOSSIBLE` | widen the gap or upgrade the transport mode |
| `BUDGET_EXCEEDED` | swap down by price level, cheapest-first, preserving must-haves |
| `DUPLICATE_PLACE` | replace the lower-ranked instance from the candidate pool |
| `INTEREST_UNMET` | targeted candidate search + insert into the day with the most slack |
| `UNKNOWN_PLACE` | drop and backfill (should be impossible by §6.1; assert loudly if seen) |

Only narrative incoherence escalates to the LLM, scoped to a single day. Repair is capped at two
rounds; anything unresolved after that surfaces as an honest, dismissible note on the trip
("we couldn't fit the Ghibli Museum — it books out; here's the link") rather than a silent
failure or an infinite loop.

---

## 9. The cost model

Google returns `priceLevel` (an enum) and sometimes `priceRange` — not prices. Museum admission,
transit fares and activity costs are simply not in the API. Every currency figure in this product
is therefore modelled by us, and honesty about that is a product feature.

```
estimated_cost = accommodation + food + activities + local_transport + buffer
```

- **Accommodation:** per-night band from `destinations.cost_index` × style multiplier × party size.
- **Food:** meals/day × per-meal band from the venue's `priceLevel` × destination cost index.
- **Activities:** a small owned table of typical admission costs by `place.primary_type` and
  destination tier, overridable per place when we learn a real figure.
- **Transport:** modelled from the day's routed distance and mode (transit fare bands, taxi
  per-km, or zero for walking).
- **Buffer:** a pace- and style-dependent contingency.

Calibrated per destination via `cost_index`, seeded from published cost-of-travel data for the
top ~100 destinations and refined over time. Excludes international flights — state that
explicitly in the UI.

UI label: **"Estimated ~$1,850 AUD · excl. flights"** with a breakdown on tap. Never a bare
precise-looking number.

---

## 10. Cost control

### 10.1 The big lever: a shared destination corpus

Places calls are per-destination, not per-trip. The 10th Tokyo trip should make ~zero Places
calls. `places` + `place_cache` + `place_signals` form a corpus that every trip to that
destination reads from; misses trigger a fetch that benefits everyone after.

Warm the top ~50 destinations offline. This is the same work as seeding SEO inventory (§12) —
one job, two payoffs.

### 10.2 Field masks

Request the cheapest tier that answers the question. Discovery (stage 2) needs id, location,
types, rating, price level. Opening hours — an expensive tier — are needed only for the
~40 places that actually make the final itinerary, fetched once in a batched Place Details pass.
Getting this wrong is a 5–10x difference on the Places line.

### 10.3 Routes

- Haversine + a mode-specific speed prior during draft iteration. Zero API cost.
- Exactly **one** `computeRouteMatrix` per day, over the final ≤10 nodes, after sequencing.
- Cache legs by `(origin, dest, mode, depart_bucket)` — hourly buckets, TTL-bounded. Popular
  city-centre legs hit cache almost immediately.
- Never call Routes inside the repair loop; re-derive from the cached matrix.

### 10.4 LLM

- Default to the fast tier. Reserve the strong model for stage 4 (assignment), which is where
  judgement actually lives.
- Prompt caching on the stable system prefix and the shared destination context.
- Wire schemas are deliberately terse — output tokens dominate cost here.
- Dedupe: hash the normalised request; an identical request within a window offers the existing
  trip ("we already planned this — want a fresh take?") instead of regenerating.
- **Never regenerate a whole trip** when a day-scoped repair will do.

### 10.5 Guardrails

- Per-identity quota (anon: 1/day; free: 3/day; paid: higher), enforced before any spend.
- Global daily spend ceiling from `api_usage`, with a kill switch that degrades to "we're at
  capacity, join the waitlist" rather than silently burning budget.
- Cloudflare Turnstile before generation for anonymous users.
- Per-trip cost recorded in `ai_generations` + `api_usage`; an alert on p95 cost regression.

**Targets:** < $0.15 per trip for a warm destination, < $0.60 cold. Anything above that and the
free tier is unshippable.

---

## 11. Abuse and security

- Turnstile on anonymous generation; quota on everything.
- Rate limiting in Upstash Redis (sliding window) — not Postgres. Layers: IP, auth identity,
  and endpoint.
- All Google and OpenAI keys server-only. `NEXT_PUBLIC_*` gets exactly two values: the Supabase
  URL and anon key. The Maps JS key is separate, HTTP-referrer-restricted, and API-restricted to
  Maps JavaScript only.
- Zod-validate every input at the route boundary. Trust nothing from the client, especially
  ownership fields.
- Uploads (avatars, hero images) go to Supabase Storage with size/MIME limits, content sniffing,
  and RLS-scoped paths. Never trust the client-supplied MIME type.
- Stripe webhooks: signature verification, replay protection via an idempotency table.
- Moderation on publish for any user-authored text on a public page.
- CSP with a strict `img-src` allowlist; no `dangerouslySetInnerHTML` on user content.

---

## 12. SEO

**The risk:** publishing thousands of AI-generated near-duplicate itinerary pages is exactly the
pattern search engines classify as scaled content abuse. Done wrong this doesn't underperform —
it demotes the whole domain.

**The approach:**

1. **`noindex` by default.** Every generated trip starts `is_indexable = false`.
2. **Earn indexability.** A trip becomes indexable when it shows human signal: meaningful user
   edits, ≥N clones or saves, or manual curation. Real differentiation, real engagement.
3. **Destination hubs are the SEO asset.** `/destinations/tokyo` is a substantial, curated,
   partly human-written page that aggregates the best trips, seasonality, cost bands and
   neighbourhoods. That page can rank. An individual `/t/[slug]` page mostly should not — its job
   is to convert traffic that arrives from a shared link.
4. **One canonical URL per trip.** `/t/[slug]`. Collection pages link to it; they don't duplicate it.
5. **Structured data:** `ItemList` of `TouristAttraction` on trip pages, `Place` on destination
   hubs, `BreadcrumbList` throughout.
6. **Dynamic sitemap** covering only indexable trips and curated hubs.

**Open Graph:** a per-trip `opengraph-image.tsx` rendered at the edge and cached — destination
imagery, duration, route chain, budget, creator handle. This is the single highest-leverage
surface in the product: it's what people actually see in WhatsApp before deciding to tap.

**Vertical share graphic:** a 1080×1920 export, rendered server-side, designed to be screenshotted
into a Story. This is a genuinely good idea in the spec — but it's a *distribution* feature, so it
belongs right after sharing works, not in "polish".

---

## 13. Public trips and cloning

**Visibility:** `private` (owner only) → `unlisted` (anyone with the link, never listed or
indexed) → `public` (listed, indexable if it qualifies). Default for a new trip is `private`;
the share action promotes it to `unlisted` with one tap. Nobody should accidentally publish.

**Cloning is a deep snapshot, not a reference.**

```sql
clone_trip(source_trip_id, new_owner_id) returns uuid   -- security definer, single transaction
```
Copies trip + days + activities, resets social counters, sets `visibility='private'`,
`forked_from_trip_id`, `forked_from_version = source.version`, and `root_trip_id` (so a fork tree
of any depth still attributes the origin). Writes a `trip_clones` row and bumps
`source.clone_count`.

Why snapshot rather than live reference:
- The cloner immediately edits it — a live reference would fight them.
- The original creator editing their trip must not silently rewrite 1,000 people's plans.
- Deletion or privacy change on the original must not break existing clones.

**Attribution degrades gracefully.** The clone stores a denormalised `origin_creator_username` and
`origin_title` alongside the FK. If the original goes private or is deleted, the credit line still
renders — it just stops linking. Attribution is never a 404.

**The loop, concretely:**
```
create → share (unlisted URL + OG card) → view (no login required)
      → "Make this trip yours" → anonymous sign-in → clone → edit → share
```
The clone CTA must work **before** login. Anonymous sign-in means the clone succeeds instantly and
the account prompt comes later, at save-or-share — which is the moment the user actually wants an
account.

---

## 13b. The map — a terms constraint, not a preference

Google Maps Platform's Service Specific Terms contain a **"No use with a non-Google map"** clause:
Places content may not be shown in conjunction with a map from another provider. It may be shown
with *no* map at all.

Every coordinate in this product came from Places. So:

- The itinerary map is **Google Maps JS**, not MapLibre or Leaflet, even though a free tile
  provider would cost nothing per load.
- With no `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, the map renders **nothing** — deliberately. There
  is no substitute map, because a substitute map would be the violation.

Given Dynamic Maps is billed per load and this sits on a page built to be shared, the
implementation is defensive about it:

- **Lazy**: the Maps script loads on an IntersectionObserver, 300px before the map scrolls into
  view. A visitor who reads the hero and leaves costs nothing.
- **Per-day colour and numbering**, with one polyline per day rather than one continuous line — a
  single line would imply a journey that never happened.
- **Dotted, not solid** routes: these are straight lines between stops, not the road you would
  actually take. A solid line implies precision the map does not have.
- **Two-way linking**: selecting a day filters the map; clicking a marker scrolls the itinerary to
  that activity and highlights it. The two views never disagree about what you are looking at.
- `gestureHandling: 'cooperative'` so it never hijacks page scroll on a phone.

> The hand-rolled SVG map in the first implementation plotted Places coordinates on a non-Google
> map. It has been removed.

---

## 14. Project structure

```
app/
  (marketing)/                 landing, about
  (app)/plan/                  wizard
  (app)/trips/[id]/            owner view + editor
  (app)/me/                    my trips
  t/[slug]/page.tsx            PUBLIC trip — canonical
  t/[slug]/opengraph-image.tsx
  t/[slug]/share-card/         1080x1920 vertical export
  destinations/[...slug]/      curated hubs
  u/[username]/                minimal public profile
  api/
    trips/generate/route.ts
    trips/[id]/actions/        command-based edits
    place-photo/[id]/route.ts
    cron/                      cache refresh, counter rollup, corpus warming
    webhooks/stripe/route.ts

domain/                        PURE. no IO, no imports from lib/. 100% unit-testable.
  types/ schemas/ validation/ cost/ sequencing/

lib/
  ai/          client.ts openai.ts wire/ prompts/ stages/
  google/      places/ routes/ photos.ts
  itinerary/   pipeline.ts hydrate.ts repair.ts slug.ts clone.ts
  db/          supabase/{server,browser,admin}.ts queries/ mutations/
  auth/  ratelimit/  entitlements/  observability/  images/

components/    ui/ (shadcn) trip/ editor/ share/ map/ marketing/
hooks/
supabase/      migrations/ seed/ tests/ (pgTAP)
tests/         unit/ integration/ e2e/ fixtures/
```

The hard rule is `domain/` importing nothing from `lib/`. That boundary is what makes the
itinerary logic — the actual product — testable without a network, a database, or an API key.

---

## 15. Observability

- **Structured logs** with a `traceId` spanning the whole generation job.
- **`ai_generations` / `api_usage`** as the cost ledger; a daily rollup into unit economics
  per trip and per destination.
- **Funnel events:** `trip_events` covers view → share → clone. The two metrics that decide
  whether this product works are *shared-link → view* and *view → clone*. Instrument those before
  anything else.
- **Quality signals:** validation issues per generation, repair rounds per generation, and the
  post-generation edit rate — the last is the best available proxy for "was the itinerary
  actually good".
- **Sentry** for errors, **Vercel Analytics** for web vitals. A `/api/health` that checks
  Supabase, OpenAI and Google reachability.

---

## 16. Testing

- **Unit (vitest):** everything in `domain/` — validation rules, sequencing, the cost model, wire
  mappers. Golden fixtures for full itineraries with known defects.
- **Integration:** the pipeline against recorded Places/Routes/OpenAI fixtures. No live API calls
  in CI, ever.
- **DB (pgTAP):** RLS as a merge gate — private trips invisible to others, unlisted reachable by
  slug only, no write path accepting a client-supplied `owner_id`, `clone_trip` correctness.
- **E2E (Playwright):** the loop — generate → share → view logged out → clone → edit. Mobile
  viewport is the primary target, desktop secondary.
- **Eval harness:** a fixed set of ~20 trip briefs, generated nightly, scored on validation
  issues, geographic efficiency (km travelled/day), interest coverage and budget accuracy.
  This is how you know whether a prompt change made things better or worse — vibes won't.
