import 'server-only';
import { googlePost } from '../client';
import { z } from 'zod';
import type { LatLng } from '@/domain/types/geo';
import type { TransportMode } from '@/domain/types/taxonomy';

/**
 * Routes API.
 *
 * Billed per element (origins x destinations), capped at 625 elements — or 100
 * when the mode is TRANSIT. The pipeline issues exactly one matrix per day over
 * the final sequence, after haversine estimates have already done the iterating.
 */

const MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

const MATRIX_FIELD_MASK = [
  'originIndex',
  'destinationIndex',
  'duration',
  'distanceMeters',
  'condition',
].join(',');

const matrixElementSchema = z.object({
  originIndex: z.number().int().optional(),
  destinationIndex: z.number().int().optional(),
  duration: z.string().optional(),
  distanceMeters: z.number().optional(),
  condition: z.string().optional(),
});

export const GOOGLE_TRAVEL_MODE: Record<TransportMode, string> = {
  walking: 'WALK',
  cycling: 'BICYCLE',
  transit: 'TRANSIT',
  driving: 'DRIVE',
  rideshare: 'DRIVE',
  mixed: 'DRIVE',
};

/** TRANSIT and TRAFFIC_AWARE_OPTIMAL are capped at 100 elements, not 625. */
export function maxElementsFor(mode: TransportMode): number {
  return mode === 'transit' ? 100 : 625;
}

export interface MatrixLeg {
  readonly originIndex: number;
  readonly destinationIndex: number;
  readonly durationSeconds: number;
  readonly distanceMeters: number;
}

export async function computeRouteMatrix(args: {
  origins: readonly LatLng[];
  destinations: readonly LatLng[];
  mode: TransportMode;
  departureTime?: Date;
}): Promise<readonly MatrixLeg[]> {
  const elements = args.origins.length * args.destinations.length;
  if (elements === 0) return [];
  if (elements > maxElementsFor(args.mode)) {
    throw new Error(
      `Route matrix would be ${elements} elements, over the ${maxElementsFor(args.mode)} limit for ${args.mode}`,
    );
  }

  const travelMode = GOOGLE_TRAVEL_MODE[args.mode];
  const body: Record<string, unknown> = {
    origins: args.origins.map(toWaypoint),
    destinations: args.destinations.map(toWaypoint),
    travelMode,
  };

  if (travelMode === 'DRIVE') {
    body.routingPreference = 'TRAFFIC_AWARE';
    // A departure time is what makes traffic-aware routing mean anything, but
    // Google rejects times in the past — clamp forward.
    if (args.departureTime && args.departureTime.getTime() > Date.now() + 60_000) {
      body.departureTime = args.departureTime.toISOString();
    }
  }

  const raw = await googlePost<unknown>({
    url: MATRIX_URL,
    body,
    fieldMask: MATRIX_FIELD_MASK,
    provider: 'google_routes',
    timeoutMs: 20_000,
  });

  const parsed = z.array(matrixElementSchema).parse(raw);

  return parsed.flatMap((element) => {
    // ROUTE_NOT_FOUND is common for transit between two points with no service.
    if (element.condition && element.condition !== 'ROUTE_EXISTS') return [];
    if (element.originIndex === undefined || element.destinationIndex === undefined) return [];
    return [
      {
        originIndex: element.originIndex,
        destinationIndex: element.destinationIndex,
        durationSeconds: parseDuration(element.duration),
        distanceMeters: element.distanceMeters ?? 0,
      },
    ];
  });
}

function toWaypoint(p: LatLng) {
  return {
    waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
  };
}

/** Google returns protobuf durations as "1234s". */
function parseDuration(value: string | undefined): number {
  if (!value) return 0;
  const seconds = Number.parseFloat(value.replace(/s$/, ''));
  return Number.isFinite(seconds) ? Math.round(seconds) : 0;
}
