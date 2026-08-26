import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/db/supabase/server';
import { TRIP_CARD_COLUMNS } from '@/lib/db/selects';
import { TripCard } from '@/components/trip/trip-card';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AppMock } from '@/components/marketing/app-mock';
import { Anatomy } from '@/components/marketing/anatomy';
import { stagger } from '@/lib/utils/motion';

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
 * Leads with the product surface itself rather than a description of it: the
 * hero device is the real trip page, drawn by the real components. The claim
 * this page makes is that you can see the shape of a day, so the page shows one.
 */
export default async function LandingPage() {
  const supabase = await createClient();
  const { data: featured } = await supabase
    .from('trips')
    .select(TRIP_CARD_COLUMNS)
    .eq('visibility', 'public')
    .eq('moderation_state', 'approved')
    .is('deleted_at', null)
    .order('clone_count', { ascending: false })
    .limit(6);

  return (
    <>
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-24 sm:px-6 sm:pt-20 lg:grid lg:grid-cols-[1fr_1.08fr] lg:items-center lg:gap-16 lg:pb-32">
          <div>
            <p className="rise inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pr-4 pl-1.5 shadow-(--shadow-card)">
              <span className="grad-brand rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-white uppercase">
                New
              </span>
              <span className="text-[0.8125rem] font-medium text-steel">
                Real opening hours, on every stop
              </span>
            </p>

            <h1 className="type-display type-hero mt-6 max-w-[13ch]">
              See the shape
              <br />
              <span className="grad-text">of a day.</span>
            </h1>

            <p
              className="rise mt-6 max-w-[46ch] text-[1.125rem] leading-relaxed text-steel"
              style={stagger(1)}
            >
              Tell us where you&apos;re going and how you like to travel. You get a plan with real
              times on it — early mornings, a free afternoon, dinner that runs late — built from
              places that genuinely exist.
            </p>

            <div className="rise mt-9 flex flex-col gap-3 sm:flex-row" style={stagger(2)}>
              <Link href="/plan">
                <Button size="lg" variant="signal" block className="sm:w-auto">
                  Plan my trip
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                </Button>
              </Link>
              <Link href="/explore">
                <Button size="lg" variant="outline" block className="sm:w-auto">
                  Browse trips
                </Button>
              </Link>
            </div>

            <p className="mt-5 text-[0.8125rem] text-steel-2">
              No account needed · Free · Nothing to install
            </p>
          </div>

          <div className="mt-20 lg:mt-0">
            <AppMock />
          </div>
        </section>

        <Anatomy />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="type-display type-section">Start from a sentence</h2>
          <p className="mt-2 text-steel">However you&apos;d describe the trip to a friend.</p>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {SAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <Link
                  href={{ pathname: '/plan', query: { q: prompt } }}
                  className="inline-block rounded-full bg-surface px-4 py-2.5 text-[0.875rem] text-steel shadow-(--shadow-card) transition-all duration-200 hover:-translate-y-0.5 hover:text-signal hover:shadow-(--shadow-lift)"
                >
                  {prompt}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {featured && featured.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="type-display type-section">Trips people are copying</h2>
              <Link
                href="/explore"
                className="shrink-0 pb-1 text-[0.875rem] font-semibold text-signal hover:underline"
              >
                See all →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
