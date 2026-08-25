import { ImageResponse } from 'next/og';
import { loadTripBySlug } from '@/lib/itinerary/hydrate';
import { formatCurrency } from '@/lib/utils/format';

/**
 * The share card.
 *
 * This is the single highest-leverage surface in the product: it is what someone
 * sees in WhatsApp before deciding whether to tap. It answers where, how long
 * and how much in one glance.
 *
 * Uses the trip's own hero when there is one — hotlinked from the image
 * provider, never a Google Place Photo, which is billed per fetch and would
 * charge us for every link preview any chat app generates. Falls back to the
 * typographic layout, which is designed to stand on its own rather than look
 * like a failure.
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
  const hero = itinerary.heroImageUrl;

  // On a photograph the palette inverts, and a scrim carries the text.
  const ink = hero ? '#ffffff' : '#17150f';
  const muted = hero ? 'rgba(255,255,255,0.72)' : '#8a857a';
  const accent = hero ? '#ffb37a' : '#c2410c';
  const rule = hero ? 'rgba(255,255,255,0.28)' : '#e6e0d4';

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
          color: ink,
          position: 'relative',
        }}
      >
        {hero && (
          <img
            src={hero}
            alt=""
            width={1200}
            height={630}
            style={{ position: 'absolute', inset: 0, width: 1200, height: 630, objectFit: 'cover' }}
          />
        )}
        {hero && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background:
                'linear-gradient(90deg, rgba(10,9,6,0.86) 0%, rgba(10,9,6,0.66) 52%, rgba(10,9,6,0.34) 100%)',
            }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: muted,
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
                color: muted,
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
            borderTop: `2px solid ${rule}`,
            paddingTop: 32,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cost !== undefined && (
              <div style={{ display: 'flex', fontSize: 44, color: accent }}>
                ~{formatCurrency(cost, itinerary.request.currency)}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 22, color: muted, marginTop: 6 }}>
              estimated, excluding flights
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {itinerary.creator?.username && (
              <div style={{ display: 'flex', fontSize: 26, color: muted }}>
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
