import { ImageResponse } from 'next/og';
import { loadTripBySlug } from '@/lib/itinerary/hydrate';
import { formatCurrency } from '@/lib/utils/format';

/**
 * The share card.
 *
 * This is the single highest-leverage surface in the product: it is what someone
 * sees in WhatsApp before deciding whether to tap. It answers where, how long
 * and how much in one glance, and it is deliberately typographic rather than
 * photographic — a Google Place photo cannot legally live here, and a generic
 * stock image says nothing.
 */

export const runtime = 'nodejs';
export const alt = 'Trip itinerary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const itinerary = await loadTripBySlug(slug);

  if (!itinerary) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#fdfbf7', color: '#17150f', fontSize: 48,
          }}
        >
          Wayfare
        </div>
      ),
      size,
    );
  }

  const route = itinerary.destinations.map((d) => d.name);
  const cost = itinerary.estimatedCost?.total;
  const days = itinerary.request.dates.durationDays;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fdfbf7',
          padding: 72,
          fontFamily: 'sans-serif',
          color: '#17150f',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#8a857a',
            }}
          >
            {days} {days === 1 ? 'day' : 'days'}
            {route.length > 0 ? ` · ${route.join(' → ')}` : ''}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: itinerary.title.length > 42 ? 68 : 88,
              lineHeight: 1.02,
              marginTop: 24,
              maxWidth: 1000,
              letterSpacing: -2,
            }}
          >
            {itinerary.title}
          </div>

          {itinerary.subtitle && (
            <div
              style={{
                display: 'flex',
                fontSize: 32,
                marginTop: 24,
                color: '#57534a',
                maxWidth: 900,
              }}
            >
              {itinerary.subtitle.slice(0, 110)}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderTop: '2px solid #e6e0d4',
            paddingTop: 32,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cost !== undefined && (
              <div style={{ display: 'flex', fontSize: 44, color: '#c2410c' }}>
                ~{formatCurrency(cost, itinerary.request.currency)}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 22, color: '#8a857a', marginTop: 6 }}>
              estimated, excluding flights
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {itinerary.creator?.username && (
              <div style={{ display: 'flex', fontSize: 26, color: '#57534a' }}>
                @{itinerary.creator.username}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 30, marginTop: 8, letterSpacing: -0.5 }}>
              Wayfare
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
