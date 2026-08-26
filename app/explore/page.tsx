import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard, type TripCardData } from '@/components/trip/trip-card';
import { ExploreSearch } from '@/components/explore/explore-search';
import { ExploreFilters } from '@/components/explore/explore-filters';
import { DURATION_BANDS, SORTS, type SortKey } from '@/components/explore/filter-options';
import { INTERESTS, TRAVEL_STYLES } from '@/domain/types/taxonomy';

export const metadata: Metadata = {
  title: 'Explore trips',
  description: 'Real itineraries built by other travellers. Copy any of them and make it yours.',
};

export const dynamic = 'force-dynamic';

interface ExploreParams {
  q?: string;
  sort?: string;
  days?: string;
  style?: string;
  interest?: string;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<ExploreParams>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const sort: SortKey = SORTS.some((s) => s.key === params.sort)
    ? (params.sort as SortKey)
    : query
      ? 'relevance'
      : 'popular';

  const band = DURATION_BANDS.find((b) => b.key === params.days);
  const style = TRAVEL_STYLES.includes(params.style as never) ? params.style : undefined;
  const interest = INTERESTS.includes(params.interest as never) ? params.interest : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_trips', {
    p_query: query || undefined,
    p_min_days: band?.min,
    p_max_days: band?.max,
    p_style: style,
    p_interest: interest,
    p_sort: sort,
    p_limit: 24,
  });

  // Search reshapes rows for ranking; the card expects the table's shape.
  const trips: TripCardData[] = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    duration_days: row.duration_days,
    currency: row.currency,
    estimated_cost_total: row.estimated_cost_total,
    hero_image_url: row.hero_image_url,
    hero_credit: row.hero_credit,
    clone_count: row.clone_count,
    like_count: row.like_count,
    interests: row.interests,
    travel_style: row.travel_style,
    profiles: {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="type-display type-title">
          {query ? `Trips matching “${query}”` : 'Trips worth copying'}
        </h1>
        <p className="mt-3 max-w-xl text-steel">
          {query
            ? `${trips.length}${trips.length === 24 ? '+' : ''} ${trips.length === 1 ? 'trip' : 'trips'} found.`
            : 'Every one of these was built from real places and shared by the person who planned it.'}
        </p>

        <div className="mt-8 space-y-4">
          {/* Keyed on the query so a back-navigation remounts it with the
              right value instead of syncing props into state. */}
          <ExploreSearch key={query} initialQuery={query} />
          <ExploreFilters
            query={query}
            sort={sort}
            days={params.days}
            style={style}
            interest={interest}
          />
        </div>

        {error && (
          <p role="alert" className="mt-10 text-sm text-critical">
            Search is having a moment. Try again shortly.
          </p>
        )}

        {trips.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <div className="mt-16 rounded-panel border border-rule bg-surface p-10 text-center">
            <p className="type-display text-xl">
              {query ? 'Nothing matched that' : 'Nothing here yet'}
            </p>
            <p className="mt-2 text-steel">
              {query
                ? 'Try a destination, or something you want to do there.'
                : 'Be the first — build a trip and share it.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {query && (
                <Link
                  href="/explore"
                  className="rounded-full border border-rule-2 bg-surface px-6 py-3 text-sm"
                >
                  Clear search
                </Link>
              )}
              <Link
                href={query ? { pathname: '/plan', query: { q: query } } : '/plan'}
                className="rounded-full bg-signal px-6 py-3 text-sm font-semibold text-ink"
              >
                {query ? `Plan a trip to ${query}` : 'Plan a trip'}
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
