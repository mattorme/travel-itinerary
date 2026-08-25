import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { loadTripBySlug } from '@/lib/itinerary/hydrate';
import { getSessionUser } from '@/lib/auth/session';
import { recordTripView } from '@/lib/itinerary/events';
import { TripView } from '@/components/trip/trip-view';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PublicTripActions } from '@/components/trip/public-trip-actions';
import { Comments } from '@/components/trip/comments';
import { createClient } from '@/lib/db/supabase/server';
import { publicEnv } from '@/lib/public-env';
import { formatCurrency } from '@/lib/utils/format';

/**
 * The public trip page — the canonical URL for a trip and the product's main
 * acquisition surface. Everything about it is tuned for someone arriving cold
 * from a link in a group chat.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const itinerary = await loadTripBySlug(slug);
  if (!itinerary) return { title: 'Trip not found' };

  const route = itinerary.destinations.map((d) => d.name).join(' → ');
  const cost = itinerary.estimatedCost?.total;
  const description = [
    `${itinerary.request.dates.durationDays} days${route ? ` · ${route}` : ''}`,
    cost !== undefined ? `~${formatCurrency(cost, itinerary.request.currency)} estimated` : null,
    itinerary.summary?.slice(0, 120),
  ]
    .filter(Boolean)
    .join(' · ');

  const url = `${publicEnv.siteUrl}/t/${itinerary.slug}`;

  return {
    title: itinerary.title,
    description,
    alternates: { canonical: url },
    // Indexability is earned, not automatic: a trip is noindex until people
    // have actually done something with it. See docs/ARCHITECTURE.md §12.
    robots: { index: itinerary.isIndexable, follow: true },
    openGraph: {
      type: 'article',
      url,
      title: itinerary.title,
      description,
      siteName: 'Wayfare',
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: itinerary.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: itinerary.title,
      description,
      images: [`${url}/opengraph-image`],
    },
  };
}

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const itinerary = await loadTripBySlug(slug);

  // RLS already refuses private trips belonging to someone else, so a miss here
  // is genuinely "not found" from this caller's point of view.
  if (!itinerary) notFound();

  const user = await getSessionUser();
  const isOwner = user !== null && itinerary.creator?.id === user.id;

  const supabase = await createClient();

  // Viewer state and the comment thread in one pass, so the page is a single
  // round of queries rather than a waterfall.
  const [liked, saved, commentRows] = await Promise.all([
    user
      ? supabase.from('trip_likes').select('trip_id').eq('trip_id', itinerary.id).eq('profile_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('trip_saves').select('trip_id').eq('trip_id', itinerary.id).eq('profile_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc('trip_comments', { p_trip_id: itinerary.id }),
  ]);

  const comments = (commentRows.data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.author_id,
    username: row.username,
    displayName: row.display_name,
  }));

  const headerList = await headers();
  await recordTripView({
    tripId: itinerary.id,
    ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0',
    userAgent: headerList.get('user-agent') ?? '',
    referrer: headerList.get('referer'),
  });

  return (
    <>
      <SiteHeader />
      <main className="pt-8">
        <TripView
          itinerary={itinerary}
          actions={
            <PublicTripActions
              itinerary={itinerary}
              isOwner={isOwner}
              initiallyLiked={liked.data !== null}
              initiallySaved={saved.data !== null}
            />
          }
          footer={
            <Comments
              tripId={itinerary.id}
              tripSlug={itinerary.slug}
              comments={comments}
              viewerId={user?.id ?? null}
              canComment={user !== null && !user.isAnonymous}
            />
          }
        />
      </main>
      <SiteFooter />
    </>
  );
}
