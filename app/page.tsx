import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/db/supabase/server';
import { TripCard } from '@/components/trip/trip-card';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DAY_COLOURS } from '@/components/trip/map/types';

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
 * Opens on the product's actual thesis rather than a decorative hero: a day
 * laid out as a route, with times, connections and the geography holding
 * together. That is the thing a generic itinerary generator cannot show, so it
 * is what the page leads with.
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
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <p className="type-label text-steel">Real places · Real routes</p>

            <h1 className="type-display type-hero mt-4 max-w-[14ch]">
              Itineraries worth actually sharing.
            </h1>

            <p className="mt-6 max-w-[46ch] text-[1.125rem] leading-relaxed text-steel">
              Tell us where you&apos;re going and how you like to travel. You get a day-by-day
              plan built from places that genuinely exist, ordered so you&apos;re not crossing the
              city four times.
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

          {/* The thesis, drawn: a day is a line with stops on it. */}
          <SampleRoute />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <p className="type-label mb-3 text-steel-2">Try one of these</p>
          <ul className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <Link
                  href={{ pathname: '/plan', query: { q: prompt } }}
                  className="inline-block rounded-edge border border-rule-2 px-3.5 py-2 text-[0.875rem] text-steel transition-colors hover:border-ink hover:text-ink"
                >
                  {prompt}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Three claims, each one a thing a generic AI wrapper cannot say. */}
        <section className="border-y border-ink bg-sunk">
          <div className="mx-auto grid max-w-6xl gap-px bg-rule sm:grid-cols-3">
            {[
              {
                n: '01',
                title: 'Places that exist',
                body: 'Every stop is a real, current listing with real opening hours. The model chooses between verified options — it never invents a restaurant.',
              },
              {
                n: '02',
                title: 'Days that hold together',
                body: 'Stops are ordered by actual travel time, so a day is one part of a city rather than famous names scattered across a map.',
              },
              {
                n: '03',
                title: 'Built to pass on',
                body: 'Every trip gets a link that looks right in a group chat. Anyone can open it, and make it theirs in one tap.',
              },
            ].map((item) => (
              <div key={item.n} className="bg-paper px-5 py-8 sm:px-6 sm:py-10">
                <p className="type-data text-[0.8125rem] text-signal">{item.n}</p>
                <h2 className="type-display mt-3 text-[1.375rem] leading-tight">{item.title}</h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-steel">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {featured && featured.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mb-8 flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
              <h2 className="type-display type-title">Trips people are copying</h2>
              <Link href="/explore" className="type-label shrink-0 pb-1 text-steel hover:text-ink">
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
 * A day, drawn as a line diagram.
 *
 * Static and hand-specified rather than pulled from a real trip: it is the
 * page's argument, and it needs to be legible before anything has loaded.
 */
function SampleRoute() {
  const colour = DAY_COLOURS[0] as string;
  const stops = [
    { time: '9:30am', name: 'Yanaka Cemetery walk', note: 'Before anything opens' },
    { leg: '12 min walk · 0.9 km' },
    { time: '10:50am', name: 'Yanaka Ginza', note: 'One sloping street of small shops' },
    { leg: '14 min walk · 1.1 km' },
    { time: '12:20pm', name: 'Soba lunch in Nezu', note: 'Counter seating, cash only' },
    { leg: '8 min walk · 0.6 km' },
    { time: '1:50pm', name: 'Nezu Shrine', note: 'Early 1700s, original buildings' },
  ];

  return (
    <div className="mt-14 border border-rule bg-surface p-5 sm:p-6 lg:mt-0" aria-hidden>
      <div className="flex items-center gap-3 border-b border-rule pb-3">
        <span className="type-label px-2 py-1 text-white" style={{ backgroundColor: colour }}>
          Day 1
        </span>
        <span className="type-label text-steel-2">The old east side</span>
      </div>

      <ol className="mt-5 list-none">
        {stops.map((stop, i) =>
          'leg' in stop ? (
            <li key={i} className="grid grid-cols-[3.5rem_auto_1fr] gap-x-3 pb-4">
              <span />
              <span className="flex justify-center">
                <span
                  className="w-[var(--rail-width)]"
                  style={{ backgroundColor: colour, opacity: 0.4 }}
                />
              </span>
              <span className="type-data text-[0.75rem] text-steel-2">{stop.leg}</span>
            </li>
          ) : (
            <li key={i} className="grid grid-cols-[3.5rem_auto_1fr] gap-x-3">
              <span className="type-data pt-0.5 text-[0.75rem] text-steel">{stop.time}</span>
              <span className="flex flex-col items-center">
                <span
                  className="type-data grid size-5 shrink-0 place-items-center rounded-full border-[3px] bg-surface text-[0.625rem]"
                  style={{ borderColor: colour, color: colour }}
                >
                  {Math.floor(i / 2) + 1}
                </span>
                {i < stops.length - 1 && (
                  <span
                    className="mt-1 w-[var(--rail-width)] flex-1"
                    style={{ backgroundColor: colour, opacity: 0.4 }}
                  />
                )}
              </span>
              <span className="pb-4">
                <span className="type-display block text-[1rem] leading-tight">{stop.name}</span>
                <span className="block text-[0.8125rem] text-steel">{stop.note}</span>
              </span>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
