# Where the project is

**Read this first.** It is the single orientation: what exists, what works, what
doesn't, and what to do next. Everything else is detail.

| | |
|---|---|
| **Runs** | Yes — locally, right now, with no paid API keys |
| **Generates itineraries** | No — needs OpenAI + Google keys (see [Getting it running](#getting-it-running)) |
| **Deployed** | No |
| **Pushed to GitHub** | No — 17 commits on `feat/initial-init`, local only |
| **Size** | ~16k lines TypeScript, ~2.9k SQL, 16 migrations, 24 routes |
| **Tests** | 136 unit/integration, 51 pgTAP, 126 Playwright — all passing |

---

## 1. What this is

A social travel planning platform. Three loops:

```
       AI builds it          you share a link        they tap one button
  ┌──────────────────┐   ┌────────────────────┐   ┌────────────────────┐
  │  plan → generate │ → │  share → view      │ → │  clone → edit      │ ─┐
  └──────────────────┘   └────────────────────┘   └────────────────────┘  │
          ▲                                                                │
          └────────────────────────────────────────────────────────────────┘
```

The itinerary is the social object. The public trip page is the acquisition
channel. Cloning is retention. That framing drove most of the decisions.

---

## 2. What is built and working

Everything here runs today, locally, and is covered by tests.

### Planning
- Seven-step mobile-first wizard: destination, dates, travellers, budget, style,
  interests, free-text notes
- Generation runs as a **background job**, not an HTTP request — survives a
  refresh or a locked phone, with live progress over Supabase Realtime
- Deterministic pipeline: 3 model calls for a single-destination trip regardless
  of length. Ranking, sequencing, scheduling, routing, costing and repair are
  all plain code

### The itinerary
- Editorial trip page: hero, at-a-glance stats, map, day-by-day timeline,
  travel legs, budget breakdown
- Validation + automatic repair (overpacked days, duplicates, budget overruns,
  closed venues) with a two-round cap and honest reporting of what it could not
  fix
- Costs are a model we own, labelled as estimates, excluding flights

### Editing
- **Swap** a stop for ranked alternatives — free, drawn from the destination
  corpus, sorted so the day stays geographically tight
- **Add** a stop by searching the destination, or free text
- Reorder, remove, pin (pinned survives every later re-time)
- **Delete** a trip
- Every edit re-runs the generator's own scheduling pass

### Sharing and social
- Public / unlisted / private, private by default
- OG share cards, a 1080×1920 story graphic, native + per-channel share
- Cloning with attribution and fork lineage
- Likes, saves, views, comments (moderated), follows
- Full-text search across trips and destinations
- Destination hubs with stats aggregated from real trips

### Taking it with you
- Offline itineraries (app only)
- Calendar export (`.ics`, floating local times)
- Print stylesheet

### Platform
- iOS + Android via Capacitor — **one codebase, one deploy**, no store review
  for content changes
- Installable PWA on the web
- Row Level Security throughout, pinned by 51 pgTAP assertions
- WCAG 2.1 AA gate in CI over every public page
- Cost ledger for every external call, with a daily spend ceiling

---

## 3. What is not built

Honest list. Nothing here is half-done and pretending otherwise.

| | Why it matters | Effort |
|---|---|---|
| **Regenerate a day** | The repair machinery exists; this is a small targeted model call. Could not be built without an API key. | Small |
| **Push notifications** | Plugin configured. No device-token table, no APNs/FCM credentials, no sending path. | Medium |
| **Collections** | Saving is a flat list. Grouping into boards is the part of the "Pinterest for travel" comparison that isn't built. | Medium |
| **Accommodation anchor** | Collected in the wizard and stored, but not used to anchor each day's routing. | Small |
| **Multi-destination trips** | Schema supports it end to end; the wizard gates it off until single-city quality is proven. | Medium |
| **Stripe / paid tiers** | Deliberately deferred. `subscription_tier` and an entitlement check exist so gating is a config change. | Medium |
| **App icons and splash art** | The web icon is generated. The native apps need real artwork. | Small |

---

## 4. What has never been run

Be aware of these before trusting anything:

- **Generation against real APIs.** The pipeline is covered end to end in CI
  against scripted providers, but no real itinerary has ever been produced. The
  cost targets (< $0.15 warm, < $0.60 cold) are modelled, not measured.
- **The itinerary map.** Implemented, but no Google browser key was available,
  so it has only ever been seen in its "hidden" state.
- **Unsplash photography.** Same — the generated cover art fallback is what has
  been verified.
- **The iOS and Android apps on a device.** The shells are synced and configured;
  there was no Xcode, Java or Android SDK in the environment they were built in.

---

## 5. Getting it running

### Already working (no keys needed)

```bash
npm install
npx supabase start        # prints the local keys
npm run db:reset          # migrations + seed data
npm run dev
```

Paste the printed anon and service-role keys into `.env.local`. You get the full
site with three seeded demo trips — browsing, search, sharing, cloning, editing,
comments, export.

### To generate a real itinerary

Two keys, in `.env.local`. No restart needed.

```bash
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_SERVER_KEY=AIza...
```

The Google key needs **Places API (New)** and **Routes API** enabled — the code
uses the v1 endpoints, so the legacy Places API will not work.

> First run: try **Tokyo, Kyoto, Lisbon, Mexico City, Rome or Havana**. Those are
> seeded, so destination resolution comes from the corpus and you can watch the
> cost model behave. Anything else geocodes fresh and builds the corpus from
> scratch — the expensive path, and the right one to watch `api_usage` on.

### To see the map and photography

```bash
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=...   # Maps JavaScript API, referrer-restricted
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...        # any Map ID from the Cloud console
UNSPLASH_ACCESS_KEY=...                   # free tier is fine
```

### To run the mobile apps

```bash
npm run mobile:dev        # points the shell at your machine's LAN address
npm run mobile:ios        # opens Xcode
```

Needs Xcode (iOS) or Android Studio + a JDK (Android). Neither is needed for web
work. Details in [MOBILE.md](./MOBILE.md).

### Commands

```bash
npm run dev          npm run typecheck    npm test
npm run test:e2e     npm run db:reset     npm run db:test
```

---

## 6. What to do next

In the order I would actually do them.

### First: prove the product works
1. **Add the two API keys and generate five real trips.** Everything else is
   speculation until you have read a generated itinerary and judged it as a
   traveller. Budget real time for iterating on prompts here.
2. **Check `api_usage` and `ai_generations`** after those five. If a warm trip
   costs more than ~$0.15, the free tier is unshippable and that changes the
   business before it changes the code.

### Then: make it real
3. **Push to GitHub.** 17 commits are local only. This is the single biggest
   risk right now.
4. **Deploy to Vercel** and point a domain at it. Set `CRON_SECRET`,
   `TURNSTILE_SECRET_KEY` and the Upstash credentials — without Redis, rate
   limiting silently degrades to per-instance and is useless.
5. **Have a lawyer read `/privacy` and `/terms`.** They are accurate to the code
   and carry a banner saying they are unreviewed. Remove the banner only when
   that is no longer true.
6. **Settle the Places caching question** (ARCHITECTURE §3). The code takes the
   conservative reading; changing it later is a one-table change.

### Then: grow it
7. **Warm the corpus for the top ~20 destinations.** This is one job with two
   payoffs — it makes generation nearly free for popular places *and* it seeds
   the destination hubs, which are the SEO asset.
8. **Build "regenerate a day".** Smallest remaining feature with real user value.
9. **Instrument the two numbers that matter**: shared-link → view, and
   view → clone. `trip_events` already records them; nothing reads them yet.

---

## 7. Where things live

```
domain/      Pure. No IO, no framework. The itinerary logic — validation,
             ranking, sequencing, costing, insights, export. Lint-enforced:
             importing from lib/ here is an error.
lib/         ai/  google/  itinerary/  images/  native/  db/  auth/
             ratelimit/  entitlements/  observability/
app/         Routes. /t/[slug] is the canonical public trip page.
             app/actions/ holds every server action.
components/  ui/  trip/  wizard/  explore/  profile/  auth/  legal/
supabase/    migrations/  tests/ (pgTAP)  seed.sql
tests/       unit/  integration/  e2e/  fixtures/
ios/ android/  Capacitor shells. Generated, but carry real edits.
```

The `domain/` boundary is the one architectural rule worth defending: it is what
makes the itinerary logic testable without a network, a database, or a key.

### The other documents
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the decisions and, more usefully,
  *why*. Read §3 (Google's caching terms), §6 (why the model never writes a
  place name) and §13b (why the map is Google's) before changing those areas.
- **[MOBILE.md](./MOBILE.md)** — the Capacitor shell, offline storage, and the
  App Store 4.2 risk.

---

## 8. Traps worth knowing about

Things that have already bitten once and are easy to reintroduce.

- **A SELECT policy that filters on a column blocks UPDATEs to that column.**
  Postgres applies the read policy to the *new* row. This broke soft delete on
  both `comments` and `trips`. Both are pinned by pgTAP.
- **`grant on all functions` only covers what exists when it runs.** Every new
  function needs a grant; default privileges now cover it, but check if an RPC
  mysteriously returns "permission denied".
- **`service_role` bypasses RLS but still needs table grants.** A missing grant
  surfaces as something unrelated failing.
- **Google returns HTTP 400 for a bad API key**, not 401.
- **`--color-ink-faint` is pinned at an AA-passing value.** Lightening it fails
  the accessibility gate.
- **Running `next build` kills a running `next dev`** — they share `.next`.
