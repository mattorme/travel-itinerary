'use client';

import { useMemo } from 'react';

export interface MapStop {
  readonly id: string;
  readonly dayIndex: number;
  readonly title: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * A static route overview.
 *
 * Deliberately not an interactive Google Map: the map's job here is to show
 * that the days hold together geographically, and a full JS map on a public page
 * costs a load per view and pulls attention away from the itinerary. Rendered as
 * inline SVG in a Mercator projection over the trip's own bounds — no tiles, no
 * key, no cost, and it works before JavaScript settles.
 */
export function TripMap({ stops }: { stops: readonly MapStop[] }) {
  const geometry = useMemo(() => project(stops), [stops]);
  if (!geometry) return null;

  const { points, width, height } = geometry;
  const byDay = new Map<number, typeof points>();
  for (const point of points) {
    byDay.set(point.dayIndex, [...(byDay.get(point.dayIndex) ?? []), point]);
  }

  return (
    <figure className="overflow-hidden rounded-card border border-line bg-paper-sunk">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full sm:h-72"
        role="img"
        aria-label={`Route overview with ${stops.length} stops across ${byDay.size} days`}
      >
        {[...byDay.entries()].map(([dayIndex, dayPoints]) => (
          <g key={dayIndex}>
            {dayPoints.length > 1 && (
              <polyline
                points={dayPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="var(--color-ink)"
                strokeOpacity="0.25"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {dayPoints.map((p) => (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill="var(--color-accent)"
                stroke="var(--color-paper)"
                strokeWidth="1.5"
              />
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="border-t border-line px-4 py-3 text-xs text-ink-faint">
        {stops.length} stops across {byDay.size} {byDay.size === 1 ? 'day' : 'days'}
      </figcaption>
    </figure>
  );
}

const WIDTH = 640;
const PADDING = 24;

function project(stops: readonly MapStop[]) {
  if (stops.length === 0) return null;

  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Web Mercator on latitude so the aspect ratio is not wrong at high latitudes.
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const yMin = mercator(minLat);
  const yMax = mercator(maxLat);

  const lngSpan = Math.max(maxLng - minLng, 1e-4);
  const ySpan = Math.max(yMax - yMin, 1e-4);

  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = Math.min(400, Math.max(140, (innerWidth * ySpan) / lngSpan));
  const height = innerHeight + PADDING * 2;

  const points = stops.map((stop) => ({
    id: stop.id,
    dayIndex: stop.dayIndex,
    x: PADDING + ((stop.lng - minLng) / lngSpan) * innerWidth,
    y: PADDING + (1 - (mercator(stop.lat) - yMin) / ySpan) * innerHeight,
  }));

  return { points, width: WIDTH, height };
}
