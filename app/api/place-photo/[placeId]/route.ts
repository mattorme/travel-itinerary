import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { serverEnv } from '@/lib/env';
import { recordApiUsage } from '@/lib/observability/usage';

export const runtime = 'nodejs';

/**
 * Google Place Photos, proxied.
 *
 * Two reasons this is a route rather than a URL on the page:
 *
 *  1. The photo endpoint needs the server Maps key. Putting a photo URL in the
 *     HTML would either expose that key or require a browser key with photo
 *     access, which is the same problem wearing a hat.
 *  2. Photo names live in `place_cache`, which is TTL-bounded. Resolving through
 *     the cache means an expired place stops serving photos automatically —
 *     the storage contract enforces itself rather than relying on a caller.
 *
 * Billed per fetch, so this is used on activity cards and never as a hero. The
 * CDN cache window is deliberately shorter than the cache TTL.
 */

const MAX_WIDTH = 1200;
const CACHE_SECONDS = 60 * 60 * 24 * 7;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
): Promise<NextResponse> {
  const { placeId } = await params;
  const requested = Number(request.nextUrl.searchParams.get('w') ?? 800);
  const width = Math.min(MAX_WIDTH, Math.max(200, Number.isFinite(requested) ? requested : 800));
  const index = Math.max(0, Number(request.nextUrl.searchParams.get('i') ?? 0) || 0);

  const admin = createAdminClient();
  const { data } = await admin
    .from('place_cache')
    .select('photo_names')
    .eq('place_id', placeId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  const name = data?.photo_names?.[index];
  if (!name) {
    // No photo, or the cached content has lapsed. 404 rather than a placeholder
    // so the client can fall back to its own art.
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set('maxWidthPx', String(width));
  url.searchParams.set('key', serverEnv().GOOGLE_MAPS_SERVER_KEY);

  try {
    const upstream = await fetch(url, { redirect: 'follow', cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 404 });
    }

    void recordApiUsage({ provider: 'google_photos', sku: 'places.photo', units: 1 });

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, immutable`,
      },
    });
  } catch (error) {
    console.warn('[place-photo] fetch failed', error);
    return new NextResponse(null, { status: 404 });
  }
}
