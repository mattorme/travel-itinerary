import { ImageResponse } from 'next/og';
import { loadTripBySlug } from '@/lib/itinerary/hydrate';
import { formatCurrency } from '@/lib/utils/format';

/**
 * Vertical story graphic, 1080x1920.
 *
 * A distribution feature, not decoration: the shape of the trip rendered big
 * enough to read in someone else's screenshot.
 *
 * The chain is the multi-city route when there is one, and the day themes when
 * there is not — a single-destination trip has a one-word route, which leaves
 * the middle of the card empty and says nothing. Day themes fill it and are more
 * interesting anyway.
 */
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const itinerary = await loadTripBySlug(slug);
  if (!itinerary) return new Response('Not found', { status: 404 });

  const days = itinerary.request.dates.durationDays;
  const cost = itinerary.estimatedCost?.total;
  const country = itinerary.destinations[0]?.name ?? '';

  const route = itinerary.destinations.map((d) => d.name);
  const chain = route.length > 1 ? route : itinerary.days.map((d) => d.title);
  // Six lines is what fits at a size worth screenshotting. Beyond that the last
  // line becomes a count so the card stays honest about what it is showing.
  const shown = chain.slice(0, 6);
  const overflow = chain.length - shown.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#111316',
          color: '#fcfcfa',
          padding: 96,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 32, letterSpacing: 6, color: '#a0a1a2' }}>
            {country.toUpperCase()}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 128,
              lineHeight: 0.95,
              marginTop: 24,
              letterSpacing: -4,
            }}
          >
            {days} DAYS
          </div>
          <div style={{ display: 'flex', fontSize: 44, marginTop: 32, color: '#c9cbcd', maxWidth: 860 }}>
            {itinerary.title}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((entry, index) => (
            <div key={`${entry}-${index}`} style={{ display: 'flex', flexDirection: 'column' }}>
              {index > 0 && (
                <div style={{ display: 'flex', fontSize: 36, color: '#6a6f77', marginLeft: 6 }}>↓</div>
              )}
              <div
                style={{
                  display: 'flex',
                  // Long day themes need to shrink or they wrap into mush.
                  fontSize: entry.length > 22 ? 44 : entry.length > 14 ? 54 : 66,
                  letterSpacing: -1,
                  lineHeight: 1.1,
                }}
              >
                {entry.toUpperCase()}
              </div>
            </div>
          ))}
          {overflow > 0 && (
            <div style={{ display: 'flex', fontSize: 34, color: '#a0a1a2', marginTop: 8 }}>
              + {overflow} more
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cost !== undefined && (
            <div style={{ display: 'flex', fontSize: 76, color: '#8ca4ff', letterSpacing: -2 }}>
              ~{formatCurrency(cost, itinerary.request.currency)}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 28, color: '#a0a1a2', marginTop: 12 }}>
            estimated, excluding flights
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 48,
              borderTop: '3px solid #34383f',
              paddingTop: 32,
            }}
          >
            <div style={{ display: 'flex', fontSize: 34, color: '#c9cbcd' }}>
              {itinerary.creator?.username ? `@${itinerary.creator.username}` : ''}
            </div>
            <div style={{ display: 'flex', fontSize: 38, letterSpacing: -1 }}>Wayfare</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
