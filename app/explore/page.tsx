import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard } from '@/components/trip/trip-card';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Explore trips',
  description: 'Real itineraries built by other travellers. Copy any of them and make it yours.',
};

export const revalidate = 120;

const SORTS = [
  { key: 'popular', label: 'Most copied', column: 'clone_count' },
  { key: 'liked', label: 'Most liked', column: 'like_count' },
  { key: 'recent', label: 'Newest', column: 'published_at' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; days?: string }>;
}) {
  const { sort, days } = await searchParams;
  const active = (SORTS.find((s) => s.key === sort) ?? SORTS[0]) as (typeof SORTS)[number];

  const supabase = await createClient();
  let query = supabase
    .from('trips')
    .select('id, slug, title, subtitle, duration_days, currency, estimated_cost_total, hero_image_url, clone_count, like_count, interests, travel_style, profiles:owner_id(username, display_name, avatar_url)')
    .eq('visibility', 'public')
    .eq('moderation_state', 'approved')
    .eq('status', 'ready')
    .is('deleted_at', null)
    .order(active.column, { ascending: false, nullsFirst: false })
    .limit(24);

  // Duration is the filter people actually use — "I have a week" is how trips
  // get planned.
  const durationBand = parseBand(days);
  if (durationBand) {
    query = query.gte('duration_days', durationBand[0]).lte('duration_days', durationBand[1]);
  }

  const { data: trips } = await query;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-display-sm">Trips worth copying</h1>
        <p className="mt-3 max-w-xl text-ink-muted">
          Every one of these was built from real places and shared by the person who planned it.
        </p>

        <div className="hide-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={{ pathname: '/explore', query: { sort: option.key, ...(days ? { days } : {}) } }}
              className={cn(
                'rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors',
                active.key === (option.key as SortKey)
                  ? 'bg-ink text-paper'
                  : 'border border-line-strong text-ink-muted hover:text-ink',
              )}
            >
              {option.label}
            </Link>
          ))}
          <span className="w-px shrink-0 bg-line" aria-hidden />
          {[
            { key: 'short', label: 'Long weekend' },
            { key: 'week', label: 'About a week' },
            { key: 'long', label: 'Two weeks +' },
          ].map((band) => (
            <Link
              key={band.key}
              href={{
                pathname: '/explore',
                query: days === band.key ? { sort: active.key } : { sort: active.key, days: band.key },
              }}
              className={cn(
                'rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors',
                days === band.key
                  ? 'bg-ink text-paper'
                  : 'border border-line-strong text-ink-muted hover:text-ink',
              )}
            >
              {band.label}
            </Link>
          ))}
        </div>

        {trips && trips.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <div className="mt-16 rounded-card border border-line bg-paper-raised p-10 text-center">
            <p className="font-display text-xl">Nothing here yet</p>
            <p className="mt-2 text-ink-muted">
              Be the first — build a trip and share it.
            </p>
            <Link
              href="/plan"
              className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-white"
            >
              Plan a trip
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function parseBand(days: string | undefined): [number, number] | null {
  switch (days) {
    case 'short': return [1, 4];
    case 'week': return [5, 9];
    case 'long': return [10, 60];
    default: return null;
  }
}
