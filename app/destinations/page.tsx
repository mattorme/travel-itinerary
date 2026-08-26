import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Destinations',
  description: 'Browse itineraries by where you are going.',
};

export const revalidate = 3600;

export default async function DestinationsPage() {
  const supabase = await createClient();
  const { data: destinations } = await supabase
    .from('destinations')
    .select('slug, name, country_name, trip_count, blurb')
    .gt('trip_count', 0)
    .order('trip_count', { ascending: false })
    .limit(60);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="type-display type-title">Destinations</h1>
        <p className="mt-3 max-w-xl text-steel">
          Places people are planning trips to right now.
        </p>

        {destinations && destinations.length > 0 ? (
          <ul className="mt-10 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {destinations.map((destination) => (
              <li key={destination.slug}>
                <Link
                  href={`/destinations/${destination.slug}`}
                  className="flex items-baseline justify-between gap-4 border-b border-rule py-3.5 transition-colors hover:text-ink"
                >
                  <span>
                    <span className="type-display text-lg">{destination.name}</span>
                    <span className="ml-2 text-sm text-steel-2">{destination.country_name}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-steel-2">
                    {destination.trip_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          // An empty screen is an invitation, not a notice.
          <div className="mt-12 rounded-panel bg-surface p-8 shadow-(--shadow-card)">
            <h2 className="type-display text-[1.5rem]">Nothing here yet</h2>
            <p className="mt-2 max-w-md text-steel">
              Destinations appear once trips have been planned to them. Plan the first one and it
              will show up here.
            </p>
            <Link href="/plan" className="mt-5 inline-block">
              <Button variant="signal">Plan a trip</Button>
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
