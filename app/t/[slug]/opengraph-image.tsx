import { ImageResponse } from 'next/og';
import { loadTripBySlug } from '@/lib/itinerary/hydrate';
import { arcSegments, type TimeBand } from '@/domain/schedule/time-of-day';
import { formatCurrency } from '@/lib/utils/format';

/**
 * The share card.
 *
 * This is the single highest-leverage surface in the product: it is what
 * someone sees in WhatsApp before deciding whether to tap. It answers where,
 * how long, how much — and then shows the trip's actual shape, hour by hour,
 * which is the one thing a link preview from anywhere else cannot show.
 *
 * Uses the trip's own hero when there is one — hotlinked from the image
 * provider, never a Google Place Photo, which is billed per fetch and would
 * charge us for every link preview any chat app generates.
 */

export const runtime = 'nodejs';
export const alt = 'Trip itinerary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#141b34';
const BAND: Record<TimeBand, string> = {
  morning: '#f2a65a',
  afternoon: '#5fd0c4',
  evening: '#f2867a',
};

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
            background: INK, color: '#ffffff', fontSize: 48,
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

  // At most six rows: past that the arcs become hairlines nobody can read at
  // preview size, and the day count in the eyebrow already carries the length.
  const scheduled = itinerary.days
    .map((day) => ({ dayIndex: day.dayIndex, segments: arcSegments(day.activities) }))
    .filter((day) => day.segments.length > 0)
    .slice(0, 6);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: 68,
          fontFamily: 'sans-serif',
          color: '#ffffff',
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
        {/* Anchored to ink on the left, where every word sits. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: hero
              ? 'linear-gradient(90deg, rgba(20,27,52,0.94) 0%, rgba(20,27,52,0.86) 55%, rgba(20,27,52,0.5) 100%)'
              : 'linear-gradient(120deg, rgba(36,48,82,0.75) 0%, rgba(20,27,52,0) 60%)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 23,
              letterSpacing: 5,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            {days} {days === 1 ? 'day' : 'days'}
            {route.length > 0 ? ` · ${route.join(' → ')}` : ''}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: itinerary.title.length > 42 ? 66 : 84,
              lineHeight: 1.02,
              marginTop: 22,
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
                fontSize: 30,
                marginTop: 20,
                color: 'rgba(255,255,255,0.75)',
                maxWidth: 880,
              }}
            >
              {itinerary.subtitle.slice(0, 110)}
            </div>
          )}
        </div>

        {/* The trip's shape. Same window, same colours, same data as the page. */}
        {scheduled.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
              position: 'relative',
              maxWidth: 720,
            }}
          >
            {scheduled.map((day) => (
              <div key={day.dayIndex} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 62,
                    fontSize: 19,
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  Day {day.dayIndex}
                </div>
                <div
                  style={{
                    display: 'flex',
                    position: 'relative',
                    flex: 1,
                    height: 12,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.12)',
                  }}
                >
                  {day.segments.map((segment, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${segment.offset * 100}%`,
                        width: `${segment.width * 100}%`,
                        borderRadius: 6,
                        background: BAND[segment.band],
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderTop: '2px solid rgba(255,255,255,0.18)',
            paddingTop: 26,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cost !== undefined && (
              <div style={{ display: 'flex', fontSize: 42, color: BAND.morning }}>
                ~{formatCurrency(cost, itinerary.request.currency)}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                fontSize: 21,
                color: 'rgba(255,255,255,0.6)',
                marginTop: 6,
              }}
            >
              estimated, excluding flights
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {itinerary.creator?.username && (
              <div
                style={{ display: 'flex', fontSize: 25, color: 'rgba(255,255,255,0.6)' }}
              >
                @{itinerary.creator.username}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 29, marginTop: 8, letterSpacing: -0.5 }}>
              Wayfare
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
