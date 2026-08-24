import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

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
        <h1 className="font-display text-display-sm">Destinations</h1>
        <p className="mt-3 max-w-xl text-ink-muted">
          Places people are planning trips to right now.
        </p>

        {destinations && destinations.length > 0 ? (
          <ul className="mt-10 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {destinations.map((destination) => (
              <li key={destination.slug}>
                <Link
                  href={`/destinations/${destination.slug}`}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 transition-colors hover:text-accent"
                >
                  <span>
                    <span className="font-display text-lg">{destination.name}</span>
                    <span className="ml-2 text-sm text-ink-faint">{destination.country_name}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ink-faint">
                    {destination.trip_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-12 text-ink-muted">No destinations yet — plan the first trip.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
