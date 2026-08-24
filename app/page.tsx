import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/db/supabase/server';
import { TripCard } from '@/components/trip/trip-card';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const revalidate = 300;

const SAMPLE_PROMPTS = [
  '5 days in Tokyo, love food and history, hate crowds',
  '10 days in Portugal on a budget',
  'A week in Mexico City with two teenagers',
  '4 days in Rome, no rushing',
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: featured } = await supabase
    .from('trips')
    .select('id, slug, title, subtitle, duration_days, currency, estimated_cost_total, hero_image_url, clone_count, like_count, interests, travel_style, profiles:owner_id(username, display_name, avatar_url)')
    .eq('visibility', 'public')
    .eq('moderation_state', 'approved')
    .is('deleted_at', null)
    .order('clone_count', { ascending: false })
    .limit(6);

  return (
    <>
      <SiteHeader />

      <main>
        {/* Hero. Mobile-first: the display type is large on a phone too, because
            the phone is where this product is actually used. */}
        <section className="mx-auto max-w-5xl px-5 pt-14 pb-20 sm:pt-24 sm:pb-28">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">
            Real places · Real routes
          </p>

          <h1 className="font-display text-display max-w-3xl text-balance">
            Itineraries worth
            <br />
            actually sharing.
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted">
            Tell us where you&apos;re going and how you like to travel. You&apos;ll get a
            day-by-day plan built from places that genuinely exist, sequenced so you&apos;re not
            crossing the city four times.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/plan">
              <Button size="lg" variant="accent" block className="sm:w-auto">
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

          <p className="mt-5 text-sm text-ink-faint">
            No account needed to start. Free.
          </p>

          <ul className="mt-14 flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <Link
                  href={{ pathname: '/plan', query: { q: prompt } }}
                  className="inline-block rounded-full border border-line bg-paper-raised px-4 py-2 text-sm text-ink-muted transition-colors hover:border-ink/30 hover:text-ink"
                >
                  {prompt}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* How it differs. Three claims, each one a thing a generic AI wrapper
            cannot say. */}
        <section className="border-y border-line bg-paper-sunk">
          <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-3 sm:py-20">
            {[
              {
                title: 'Places that exist',
                body: 'Every stop is a real, current listing with real opening hours. The model chooses between verified options — it never invents a restaurant.',
              },
              {
                title: 'Days that make sense',
                body: 'Stops are sequenced by actual travel time, so a day holds together geographically instead of scattering famous names across a map.',
              },
              {
                title: 'Built to pass on',
                body: 'Every trip gets a link that looks good in a group chat. Anyone can open it, and make it theirs in one tap.',
              },
            ].map((item) => (
              <div key={item.title}>
                <h2 className="font-display text-xl">{item.title}</h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {featured && featured.length > 0 && (
          <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="font-display text-display-sm">Trips people are copying</h2>
              <Link href="/explore" className="shrink-0 text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
                See all
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
