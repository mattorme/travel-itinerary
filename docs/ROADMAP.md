# Implementation Roadmap

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). Each milestone is independently
reviewable and leaves the app in a working state. Nothing is merged without its tests.

## Status

M0–M14 are **built**. The whole loop works end to end: plan → generate →
render → edit → share → view logged out → clone → edit.

Verified: `tsc --noEmit` clean under `strict` with zero `any`, ESLint clean,
105 unit and integration tests, 29 pgTAP assertions, 36 Playwright tests across
mobile and desktop, production build green.

Generation itself needs a real `OPENAI_API_KEY` and `GOOGLE_MAPS_SERVER_KEY`.
Everything else — the wizard, public pages, sharing, cloning, editing — runs
without them, and the pipeline is covered end to end in CI against scripted
providers.

Still open before a public launch:

- `/privacy` and `/terms` are placeholders and are linked from every page
- `CRON_SECRET`, Turnstile and Upstash credentials must be set (the cron
  endpoints refuse to run without a secret; rate limiting falls back to
  in-process without Redis, which is useless across instances)
- Confirm the Places caching position with counsel — see ARCHITECTURE §3
- Manual pass on real iOS Safari; CI covers Chromium only
- Unit economics have not been measured against live APIs, only modelled

**Definition of done, every milestone:** typechecks with `strict` and zero `any`; tests pass;
no mock data left behind unless a `// TEMPORARY:` comment says why and when it goes.

---

## M0 — Foundations *(~0.5 day)*

Next.js 16 (App Router, TS strict) · Tailwind · shadcn/ui · ESLint/Prettier · vitest · Playwright ·
Supabase local dev · env schema validated at boot with Zod so a missing key fails at startup, not
at 2am in a route handler · CI: typecheck + lint + unit + pgTAP.

**Exit:** `pnpm dev` runs, `pnpm test` passes, CI is green on an empty test suite.

---

## M1 — Database and domain model *(~1 day)*

Full schema from §4 as ordered migrations · RLS policies + `can_read_trip` · pgTAP RLS suite ·
generated DB types · `domain/types` + `domain/schemas` (Zod) · seed data for ~10 destinations.

**Exit:** pgTAP proves a private trip is invisible to a second user and an unlisted trip is
reachable by slug only. Domain types compile with no `any`.

**Review gate:** schema and RLS. Everything downstream depends on these being right; changing
them after there's data is painful.

---

## M2 — Auth and shell *(~1 day)*

Supabase Auth (email OTP + Google) · anonymous sign-in · `@supabase/ssr` server/browser/admin
clients · middleware session refresh · profile creation trigger with username generation ·
app shell, nav, mobile-first layout primitives.

**Exit:** anonymous → create → sign up → still owns the trip. Verified in an E2E test.

---

## M3 — Trip wizard *(~1.5 days)*

Mobile-first multi-step wizard: destination (Places Autocomplete, server-proxied) → dates →
travellers → budget/currency → style + pace → interests → transport/food → free-text notes.
Zod-validated per step, resumable, URL-driven state. Writes a `trips` row in `draft`.

**Exit:** a complete, validated `TripRequest` persists. No generation yet.

**Design gate:** this is the first thing a user touches. It must not feel like a form. Review the
UI before moving on.

---

## M4 — Google Places service *(~1.5 days)*

`lib/google/places`: Text Search, Nearby Search, Place Details, Autocomplete · tiered field masks
per call site · `places` / `place_cache` with TTL · hydration + lazy refresh · request coalescing ·
per-call `api_usage` accounting · typed errors, retry with backoff, graceful zero-results.

**Exit:** a place fetched twice costs one API call. Cache expiry triggers exactly one refetch
under concurrent load. Cost per call is recorded.

---

## M5 — Generation pipeline v1 *(~3 days)* ← the hard one

Stages 0–4 and 7–8 from §6.2, single-destination only, no routing yet (haversine estimates).
`LlmClient` abstraction · wire schemas + mappers · `generation_jobs` + worker + Realtime progress ·
`ai_generations` ledger.

**Exit:** a real 5-day Tokyo itinerary from real Places data, every place verifiably real,
generated for under $0.60, with per-stage cost visible in the ledger.

**Review gate:** read three generated itineraries end to end and judge them as a traveller, not
as an engineer. If they're not genuinely good, iterate here — everything after this is packaging.

---

## M6 — Itinerary rendering *(~2 days)*

Day-by-day timeline, activity cards, budget breakdown, highlights · mobile-first, desktop
enhances · progressive rendering as days land · skeletons, empty and failure states ·
Google attribution baked into the card component.

**Exit:** looks good on a 375px viewport. Day 1 visible within ~8s of submitting.

---

## M7 — Routes and sequencing *(~1.5 days)*

`lib/google/routes` with `route_legs` cache · 2-opt day sequencing under meal/hours/lock
constraints · one route matrix per day · travel legs rendered inline in the timeline.

**Exit:** average km travelled per day drops measurably against M5 output on the eval set.
One matrix call per day, verified.

---

## M8 — Validation and repair *(~2 days)*

Full `ItineraryIssue` set · deterministic repair table (§8) · scoped LLM repair for narrative
only · two-round cap · honest surfacing of unresolved issues · golden-fixture test suite.

**Exit:** deliberately broken fixtures are detected and repaired without a full regeneration.

---

## M9 — Editing *(~2 days)*

Command-based mutations (`moveActivity`, `replaceActivity`, `removeActivity`, `addActivity`,
`retimeDay`, `lockActivity`) · optimistic UI · incremental revalidation · alternatives picker
drawn from the cached candidate pool (zero extra API cost) · undo.

**Exit:** reordering a day recomputes only affected legs and re-validates. Ownership enforced
server-side; an E2E test proves another user can't mutate someone else's trip.

---

## M10 — Public pages and sharing *(~2 days)* ← the growth loop

`/t/[slug]` public page, editorial not dashboard · visibility controls, private by default ·
`opengraph-image.tsx` · Twitter/X cards, canonical, structured data · native share sheet +
per-channel links · `trip_events` view/share tracking with dedupe.

**Exit:** paste a link into WhatsApp, iMessage, Slack, X and Discord — the card renders correctly
in all five. Logged-out viewing works.

---

## M11 — Cloning *(~1 day)* ← the retention loop

`clone_trip` RPC · "Make this trip yours" working logged-out via anonymous sign-in ·
attribution UI with graceful degradation · clone counters · fork-tree integrity tests.

**Exit:** logged-out visitor clones in one tap, gets an editable copy, original creator credited.
Deleting the original doesn't break the clone.

---

## M12 — Hardening *(~1.5 days)*

Turnstile · Upstash rate limits · entitlement checks · global spend ceiling + kill switch ·
moderation on publish · Sentry · CSP · counter rollup + cache refresh crons · security review pass.

**Exit:** cannot generate more than quota; the kill switch degrades gracefully rather than
failing; no secret in the client bundle (verified by a bundle scan in CI).

---

## M13 — Vertical share graphic *(~1 day)*

1080×1920 server-rendered export — destination, route chain, duration, budget, handle. Designed
to be screenshotted into a Story.

**Exit:** it looks good enough that you'd post it yourself. That's the bar.

---

## M14 — Discovery and SEO *(~2 days)*

Curated `/destinations/*` hubs · corpus warming for the top 50 destinations (doubles as SEO
inventory and as the cold-start seed for cloning) · indexability scoring · dynamic sitemap ·
trending/most-cloned listings.

**Exit:** ~50 substantial destination pages live, seeded with quality itineraries worth cloning.

---

## Deferred (deliberately)

Follows · comments · full social feed · rich creator profiles · Stripe · collaborative editing ·
multi-destination trips (M3–M8 keep the schema ready; the wizard gates it off until single-city
quality is proven) · flights · bookings · i18n.

---

## Sequencing note

M5 is the milestone that decides whether this product exists. Everything before it is
infrastructure and everything after it is distribution. Budget real time for iterating on
itinerary quality there, and resist moving on until three consecutive generated itineraries
read as something a knowledgeable person would have planned.
