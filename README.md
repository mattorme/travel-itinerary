# Wayfare

A social travel planning platform. AI is the engine that makes creating an
itinerary easy; the itinerary itself is the social object, the public page is
the acquisition channel, sharing is the growth loop and cloning is the retention
loop.

- [Architecture](docs/ARCHITECTURE.md) — the design and the reasoning behind it
- [Roadmap](docs/ROADMAP.md) — milestones and what is deliberately deferred

---

## The three things worth knowing before reading the code

**1. The model never writes a place name.**
It receives a shortlist of real, server-resolved candidates and returns
`{ slot_id, place_id, reason }`. Anything outside that set is discarded before it
can reach a traveller. Hallucinated restaurants are structurally impossible
rather than something validation hopes to catch.
→ `lib/ai/wire/assign-places.ts`

**2. Google place content is borrowed, not owned.**
The Maps Platform terms permit storing `place_id` indefinitely but not the
content attached to it. So `places` is permanent and ID-only, `place_cache` is
TTL-bounded (enforced by a CHECK constraint *and* an RLS policy), and rendering a
trip is a hydration. A trip page must render correctly with a completely cold
cache — which is why `activities.title` is authored text, not a copy of the
Google display name.
→ `lib/google/places/cache.ts`, [ARCHITECTURE §3](docs/ARCHITECTURE.md)

**3. The map is Google's because it has to be.**
The Maps Platform terms forbid showing Places content with a non-Google map — and every coordinate
here came from Places. Content may be shown with *no* map, so the no-key path renders nothing
rather than substituting a free tile provider. The map loads lazily on scroll, because Dynamic Maps
is billed per load and this sits on a page built to be shared.
→ `components/trip/map/trip-map.tsx`

**4. Most of the pipeline is not an LLM.**
Ranking, sequencing, scheduling, costing and repair are optimisation problems
with objective functions. There are exactly three model calls for a
single-destination trip regardless of length: shape the trip, assign places per
day, write the narrative. Everything else is plain code — cheaper, faster,
testable, and consistent.
→ `lib/itinerary/pipeline.ts`, `domain/`

---

## Getting started

Requires Node 20+, Docker (for local Supabase) and the Supabase CLI.

```bash
npm install
cp .env.example .env.local
npx supabase start        # prints the local anon and service-role keys
npm run db:types
npm run dev
```

Paste the printed keys into `.env.local`. The app runs without OpenAI or Google
keys — the wizard, public pages, sharing and cloning all work — but generation
needs both:

| Key | Needed for |
|---|---|
| `OPENAI_API_KEY` | trip generation |
| `GOOGLE_MAPS_SERVER_KEY` | Places (New) + Routes. Server-side only, restrict by API. |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | the itinerary map. Without it the map is hidden — see below |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | map style id; advanced markers need one |
| `UNSPLASH_ACCESS_KEY` | trip and destination photography. Without it, generated cover art |
| `UPSTASH_REDIS_*` | distributed rate limits (falls back to in-process) |
| `TURNSTILE_SECRET_KEY` | bot check on anonymous generation |
| `CRON_SECRET` | required before the cron endpoints will run at all |

## Commands

```bash
npm run dev          # dev server
npm run typecheck    # tsc --noEmit, strict, zero `any`
npm test             # unit + fixture-backed pipeline tests
npm run test:e2e     # Playwright, mobile and desktop
npm run db:reset     # re-run migrations and seed
npm run db:test      # pgTAP: RLS, column guards, cloning
npm run db:types     # regenerate lib/db/database.types.ts
```

## Layout

```
domain/     pure. no IO, no framework, no service clients. Lint-enforced.
              types/ schemas/ validation/ ranking/ sequencing/ cost/
lib/        ai/ google/ itinerary/ db/ auth/ ratelimit/ entitlements/ observability/
app/        routes. /t/[slug] is the canonical public trip page.
components/ ui/ trip/ wizard/ auth/
supabase/   migrations/ tests/ (pgTAP) seed.sql
tests/      unit/ integration/ e2e/ fixtures/
```

`domain/` importing anything from `lib/` is a lint error. That boundary is what
makes the itinerary logic — the actual product — testable without a network, a
database, or an API key.

## Testing

`npm test` runs the full generation pipeline end to end against scripted
providers: real planning, ranking, assignment, sequencing, scheduling, routing
and costing, with only the three external boundaries stood in for. It asserts
things that matter commercially as well as functionally — including that a trip
costs exactly *n + 2* model calls, so a regression that adds a per-activity call
fails the build rather than the invoice.

`npm run db:test` is the authorisation merge gate: private trips invisible to
others, unlisted reachable by slug only, no write path accepting a
client-supplied `owner_id`, and clone semantics (born private, attribution
denormalised, deep copy).

## Costs

Targets are **under $0.15 per trip** for a warm destination and **under $0.60**
cold. The levers, in order of impact:

1. **A shared per-destination place corpus.** Places calls are per destination,
   not per trip — the tenth Tokyo trip makes roughly zero.
2. **Field masks.** Places bills at the highest tier any requested field belongs
   to. Opening hours are fetched once, for the ~40 places that survive ranking.
3. **One route matrix per day**, over the final sequence, after haversine
   estimates have done all the iterating. Legs are cached by (origin, dest, mode,
   hour-of-week).
4. **Targeted repair.** A day-scoped fix, never a full regeneration.

Every external call writes to `api_usage` or `ai_generations`. A daily ceiling
degrades to "we're at capacity" rather than quietly emptying the account.

## Imagery

Three tiers, so a trip is never a grey box:

1. **Unsplash** for heroes, cards and share images — hotlinked and attributed as their API
   guidelines require, cached per destination so the tenth Tokyo trip reuses the ninth's search.
2. **Google Place Photos** on activity cards only, proxied through `/api/place-photo/[placeId]`.
   Billed per fetch, so never behind a hero and never in an OG image.
3. **Generated cover art** everywhere else — a deterministic topographic SVG seeded from the trip
   slug. No key, no network, no cost. This is what runs with no Unsplash key configured.

## Social

| Feature | State |
|---|---|
| Share (link, native sheet, per-channel, story graphic) | built |
| Cloning with attribution and fork lineage | built |
| Likes, saves, view and share tracking | built |
| Explore feed with sorting and duration filters | built |
| Destination hubs and creator profiles | built |
| Follows with counters | built |
| Comments with moderation | built |

Likes and saves work anonymously — they are part of planning, and a sign-up wall there would break
the growth loop. Follows and comments require a real account, enforced in the database rather than
only in the UI: a social graph and a public comment thread need somebody accountable behind them.

Comments are held for moderation before anyone but their author sees them, because a trip page can
be indexed and an unmoderated text field on an indexable page is a liability.

## Before launch

- Write `/privacy` and `/terms` (currently placeholders, linked from every page)
- Set `CRON_SECRET`, `TURNSTILE_SECRET_KEY` and the Upstash credentials
- Confirm the Places caching position with counsel (see ARCHITECTURE §3) — the
  code takes the conservative reading and it is a one-table change either way
- Manual pass on real iOS Safari; CI covers Chromium only
