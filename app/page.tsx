import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/db/supabase/server';
import { TripCard } from '@/components/trip/trip-card';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DayArc, ArcLegend } from '@/components/trip/day-arc';
import { bandOf, type TimeBand } from '@/domain/schedule/time-of-day';
import { formatMinute } from '@/domain/sequencing/schedule';

export const revalidate = 300;

const SAMPLE_PROMPTS = [
  '5 days in Tokyo, love food and history, hate crowds',
  '10 days in Portugal on a budget',
  'A week in Mexico City with two teenagers',
  '4 days in Rome, no rushing',
];

/**
 * The landing page.
 *
 * Opens on the product's actual thesis: a day you can read the shape of before
 * you read a word of it. Every other itinerary tool hands you a list; this one
 * hands you the hours, and the hero is that claim demonstrated rather than
 * described.
 */
export default async function LandingPage() {
  const supabase = await createClient();
  const { data: featured } = await supabase
    .from('trips')
    .select('id, slug, title, subtitle, duration_days, currency, estimated_cost_total, hero_image_url, hero_credit, clone_count, like_count, interests, travel_style, profiles:owner_id(username, display_name, avatar_url)')
    .eq('visibility', 'public')
    .eq('moderation_state', 'approved')
    .is('deleted_at', null)
    .order('clone_count', { ascending: false })
    .limit(6);

  return (
    <>
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14">
          <div>
            <p className="type-label text-steel">Real places · Real hours</p>

            <h1 className="type-display type-hero mt-4 max-w-[13ch]">
              See the shape of a day.
            </h1>

            <p className="mt-6 max-w-[46ch] text-[1.125rem] leading-relaxed text-steel">
              Tell us where you&apos;re going and how you like to travel. You get a plan with real
              times on it — early mornings, a free afternoon, dinner that runs late — built from
              places that genuinely exist and ordered so you&apos;re not crossing the city four
              times.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/plan">
                <Button size="lg" variant="signal" block className="sm:w-auto">
                  Plan my trip
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/explore">
                <Button size="lg" variant="outline" block className="sm:w-auto">
                  Browse trips
                </Button>
              </Link>
            </div>

            <p className="type-label mt-5 text-steel-2">No account needed · Free</p>
          </div>

          <SampleDay />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <p className="type-label mb-3 text-steel-2">Try one of these</p>
          <ul className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <Link
                  href={{ pathname: '/plan', query: { q: prompt } }}
                  className="inline-block rounded-full border border-rule-2 bg-surface px-4 py-2 text-[0.875rem] text-steel transition-colors hover:border-ink hover:text-ink"
                >
                  {prompt}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Three claims, each one a thing a generic AI wrapper cannot say. */}
        <section className="bg-ink py-16 text-white sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-3 md:gap-8">
            {[
              {
                title: 'Places that exist',
                body: 'Every stop is a real, current listing with real opening hours. The model chooses between verified options — it never invents a restaurant.',
              },
              {
                title: 'Days that hold together',
                body: 'Stops are ordered by actual travel time, so a day is one part of a city rather than famous names scattered across a map.',
              },
              {
                title: 'Built to pass on',
                body: 'Every trip gets a link that looks right in a group chat. Anyone can open it, and make it theirs in one tap.',
              },
            ].map((item) => (
              <div key={item.title}>
                <h2 className="type-display text-[1.5rem]">{item.title}</h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/70">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {featured && featured.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="type-display type-title">Trips people are copying</h2>
              <Link
                href="/explore"
                className="type-label shrink-0 pb-1.5 text-steel hover:text-ink"
              >
                See all →
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * One day of a real itinerary, drawn the way the product draws every day.
 *
 * Hand-specified rather than pulled from the database: it is the page's
 * argument, and it has to be legible before anything has loaded. The times are
 * the point — the arc across the top is generated from them by the same
 * function the trip page uses, so what the landing page promises is literally
 * what the product renders.
 */
const SAMPLE_STOPS = [
  { start: 570, minutes: 75, name: 'Yanaka Cemetery', note: 'Before anything opens' },
  { start: 660, minutes: 80, name: 'Yanaka Ginza', note: 'One sloping street of small shops' },
  { start: 800, minutes: 60, name: 'Soba lunch in Nezu', note: 'Counter seating, cash only' },
  { start: 890, minutes: 70, name: 'Nezu Shrine', note: 'Early 1700s, original buildings' },
  { start: 1140, minutes: 120, name: 'Izakaya on Kototoi-dori', note: 'Booked for four' },
] as const;

const BAND_DOT: Record<TimeBand, string> = {
  morning: 'bg-morning-ink',
  afternoon: 'bg-afternoon-ink',
  evening: 'bg-evening-ink',
};

function SampleDay() {
  const activities = SAMPLE_STOPS.map((stop) => ({
    startMinute: stop.start,
    durationMinutes: stop.minutes,
  }));

  return (
    <div className="mt-14 rounded-panel bg-surface p-5 shadow-(--shadow-card) sm:p-7 lg:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-label text-ink">Day 1 · Tokyo</p>
        <p className="type-label text-steel-2">The old east side</p>
      </div>

      <DayArc activities={activities} label="Sample day in Tokyo" animate className="mt-4" />
      <div className="type-label mt-2 flex justify-between text-steel-2">
        <span>6 am</span>
        <span>Midnight</span>
      </div>

      <div className="mt-4">
        <ArcLegend />
      </div>

      <ol className="mt-6 space-y-4 border-t border-rule pt-5">
        {SAMPLE_STOPS.map((stop) => (
          <li key={stop.name} className="flex gap-3.5">
            <span
              aria-hidden
              className={`mt-2 size-2 shrink-0 rounded-full ${BAND_DOT[bandOf(stop.start)]}`}
            />
            <div className="min-w-0">
              <p className="type-data text-[0.8125rem] text-steel-2">{formatMinute(stop.start)}</p>
              <p className="type-display text-[1.0625rem]">{stop.name}</p>
              <p className="text-[0.875rem] leading-snug text-steel">{stop.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
