import { NextResponse } from 'next/server';
import { loadTripBySlug } from '@/lib/itinerary/hydrate';
import { icsFilename, itineraryToIcs } from '@/domain/export/ics';
import { publicEnv } from '@/lib/public-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The trip as a calendar subscription.
 *
 * Goes through `loadTripBySlug`, so RLS decides what a caller may export — a
 * private trip is a 404 here exactly as it is on the page. Served as a
 * download rather than inline so that tapping it on a phone hands the file to
 * the calendar app.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const itinerary = await loadTripBySlug(slug);
  if (!itinerary) return new NextResponse('Not found', { status: 404 });

  if (!itinerary.request.dates.start) {
    return new NextResponse(
      'This trip has no dates yet, so there is nothing to put in a calendar.',
      { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const host = new URL(publicEnv.siteUrl).host;
  const ics = itineraryToIcs(itinerary, {
    domain: host,
    tripUrl: `${publicEnv.siteUrl}/t/${itinerary.slug}`,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFilename(itinerary)}"`,
      // Trips change; a stale calendar is worse than a slow one.
      'Cache-Control': 'no-store',
    },
  });
}
