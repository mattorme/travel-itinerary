import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard } from '@/components/trip/trip-card';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/public-env';

export const revalidate = 3600;

/**
 * The destination hub.
 *
 * This — not the individual trip page — is the page intended to rank. A trip
 * page's job is to convert traffic arriving from a shared link; publishing
 * thousands of near-duplicate AI-written trip pages into the index is exactly
 * the pattern that gets a domain demoted. See docs/ARCHITECTURE.md §12.
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
    .select('name, country_name, blurb')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return { title: 'Destination not found' };

  return {
    title: `${data.name} itineraries`,
    description:
      data.blurb ??
      `Day-by-day itineraries for ${data.name}, ${data.country_name}, built from real places and shared by the travellers who planned them.`,
    alternates: { canonical: `${publicEnv.siteUrl}/destinations/${slug}` },
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
    .select('id, name, country_name, blurb, timezone, trip_count')
    .eq('slug', slug)
    .maybeSingle();

  if (!destination) notFound();

  const { data: trips } = await supabase
    .from('trips')
    .select('id, slug, title, subtitle, duration_days, currency, estimated_cost_total, hero_image_url, hero_credit, clone_count, like_count, interests, travel_style, profiles:owner_id(username, display_name, avatar_url), trip_destinations!inner(destination_id)')
    .eq('trip_destinations.destination_id', destination.id)
    .eq('visibility', 'public')
    .eq('moderation_state', 'approved')
    .is('deleted_at', null)
    .order('clone_count', { ascending: false })
    .limit(18);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
          {destination.country_name}
        </p>
        <h1 className="mt-3 font-display text-display">{destination.name}</h1>
        {destination.blurb && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            {destination.blurb}
          </p>
        )}

        <div className="mt-8">
          <Link href={{ pathname: '/plan', query: { q: destination.name } }}>
            <Button variant="accent" size="lg">Plan a trip to {destination.name}</Button>
          </Link>
        </div>

        {trips && trips.length > 0 ? (
          <>
            <h2 className="mt-16 font-display text-display-sm">Itineraries</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </>
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
