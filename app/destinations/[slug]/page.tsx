import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard, type TripCardData } from '@/components/trip/trip-card';
import { Button } from '@/components/ui/button';
import { Cover } from '@/components/ui/cover';
import { formatCurrency, humanise } from '@/lib/utils/format';
import { publicEnv } from '@/lib/public-env';

export const revalidate = 3600;

/**
 * The destination hub.
 *
 * This — not the individual trip page — is the page intended to rank.
 * Publishing thousands of near-duplicate AI-written trip pages into the index
 * is the pattern that gets a domain demoted, so trips stay noindex until they
 * earn it and this page carries the weight instead.
 *
 * That only works if the page actually says something, which means it has to be
 * more than a name and a grid of cards. Everything below is aggregated from
 * trips people have really planned, so it gets better as the corpus grows
 * rather than needing to be written by hand.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('destinations')
    .select('id, name, country_name, blurb')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return { title: 'Destination not found' };

  const { data: stats } = await supabase.rpc('destination_stats', {
    p_destination_id: data.id,
  });
  const s = stats?.[0];

  const description =
    s && s.trip_count > 0
      ? `${s.trip_count} ${s.trip_count === 1 ? 'itinerary' : 'itineraries'} for ${data.name}, ${data.country_name}. Most people plan ${Math.round(Number(s.median_days))} days${s.median_cost ? `, around ${formatCurrency(Number(s.median_cost), s.currency ?? 'AUD')}` : ''}. Built from real places and shared by the travellers who planned them.`
      : (data.blurb ??
        `Day-by-day itineraries for ${data.name}, ${data.country_name}, built from real places.`);

  return {
    title: `${data.name} itineraries`,
    description,
    alternates: { canonical: `${publicEnv.siteUrl}/destinations/${slug}` },
    openGraph: { title: `${data.name} itineraries`, description, type: 'website' },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: destination } = await supabase
    .from('destinations')
    .select('id, name, country_name, country_code, blurb, timezone, hero_image_url, hero_credit')
    .eq('slug', slug)
    .maybeSingle();

  if (!destination) notFound();

  const [{ data: statsRows }, { data: places }, { data: tripRows }] = await Promise.all([
    supabase.rpc('destination_stats', { p_destination_id: destination.id }),
    supabase.rpc('destination_top_places', { p_destination_id: destination.id, p_limit: 8 }),
    supabase
      .from('trips')
      .select('id, slug, title, subtitle, duration_days, currency, estimated_cost_total, hero_image_url, hero_credit, clone_count, like_count, interests, travel_style, profiles:owner_id(username, display_name, avatar_url), trip_destinations!inner(destination_id)')
      .eq('trip_destinations.destination_id', destination.id)
      .eq('visibility', 'public')
      .eq('moderation_state', 'approved')
      .is('deleted_at', null)
      .order('clone_count', { ascending: false })
      .limit(18),
  ]);

  const stats = statsRows?.[0];
  const trips = (tripRows ?? []) as unknown as TripCardData[];
  const hasStats = Boolean(stats && stats.trip_count > 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pb-16">
        <div className="relative -mx-5 aspect-[3/2] overflow-hidden bg-paper-sunk sm:mx-0 sm:mt-6 sm:aspect-[21/9] sm:rounded-card">
          <Cover
            imageUrl={destination.hero_image_url}
            credit={destination.hero_credit as never}
            seed={slug}
            label={destination.name}
            priority
            showLabel
            sizes="(max-width: 640px) 100vw, 1024px"
          />
        </div>

        <p className="mt-8 text-xs font-medium tracking-widest text-ink-faint uppercase">
          {destination.country_name}
        </p>
        <h1 className="mt-3 font-display text-display">{destination.name}</h1>
        {destination.blurb && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            {destination.blurb}
          </p>
        )}

        {/* Aggregated from real trips, so the page has something to say the
            moment anyone plans one — and more to say as the corpus grows. */}
        {hasStats && stats && (
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
            <Stat
              label="itineraries"
              value={String(stats.trip_count)}
            />
            <Stat
              label="days, typically"
              value={
                stats.min_days === stats.max_days
                  ? String(stats.min_days)
                  : `${stats.min_days}–${stats.max_days}`
              }
            />
            {stats.median_cost !== null && (
              <Stat
                label="typical budget"
                value={`~${formatCurrency(Number(stats.median_cost), stats.currency ?? 'AUD')}`}
              />
            )}
            {stats.common_pace && (
              <Stat label="usual pace" value={humanise(stats.common_pace)} />
            )}
          </dl>
        )}

        {hasStats && stats?.top_interests && stats.top_interests.length > 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            People come here for{' '}
            <strong className="font-normal text-ink">
              {stats.top_interests.slice(0, 3).map(humanise).join(', ')}
            </strong>
            .
          </p>
        )}

        <div className="mt-8">
          <Link href={{ pathname: '/plan', query: { q: destination.name } }}>
            <Button variant="accent" size="lg">
              Plan a trip to {destination.name}
            </Button>
          </Link>
        </div>

        {/* Ranked by how many separate trips use a place, not by rating: twenty
            travellers ending up somewhere is a better signal than a high score
            nobody acted on. */}
        {places && places.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-display-sm">Where people actually go</h2>
            <p className="mt-2 text-ink-muted">
              The places that turn up most often in {destination.name} itineraries.
            </p>
            <ul className="mt-8 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {places.map((place) => (
                <li key={place.place_id} className="border-b border-line py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0">
                      <span className="font-display text-lg">{place.name}</span>
                      {place.tags?.[0] && (
                        <span className="ml-2 text-sm text-ink-faint">
                          {humanise(place.tags[0])}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm text-ink-faint">
                      {place.rating !== null && (
                        <span className="flex items-center gap-1">
                          <Star className="size-3.5 fill-current" aria-hidden />
                          {Number(place.rating).toFixed(1)}
                        </span>
                      )}
                      {place.maps_url && (
                        <a
                          href={place.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-ink"
                          aria-label={`${place.name} on Google Maps`}
                        >
                          <MapPin className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-faint">Place information from Google Maps.</p>
          </section>
        )}

        {trips.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-display text-display-sm">Itineraries</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </section>
        ) : (
          <p className="mt-16 text-ink-muted">
            No public trips here yet. Plan one and it will be the first.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-raised px-4 py-4">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
