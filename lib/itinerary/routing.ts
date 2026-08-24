import 'server-only';
import type { LatLng } from '@/domain/types/geo';
import { estimateTravelSeconds, haversineMeters, inferMode } from '@/domain/types/geo';
import type { PlaceId } from '@/domain/types/ids';
import type { TravelLeg } from '@/domain/types/itinerary';
import type { TransportMode } from '@/domain/types/taxonomy';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { computeRouteMatrix, maxElementsFor } from '@/lib/google/routes/client';
import { recordApiUsage } from '@/lib/observability/usage';

/**
 * Stage 6: real travel times for the final sequence.
 *
 * Routes is billed per element, so the pipeline issues exactly one matrix per
 * day, over the already-sequenced stops, after haversine estimates have done all
 * the iterating. Legs are cached by (origin, dest, mode, hour-of-week) — popular
 * city-centre pairs hit cache almost immediately, and the cache is TTL-bounded
 * for the same reason place content is.
 */

const LEG_TTL_DAYS = 25;

export interface RouteStop {
  readonly placeId: PlaceId;
  readonly location: LatLng;
}

export interface ResolvedLeg extends TravelLeg {
  readonly fromPlaceId: PlaceId;
  readonly toPlaceId: PlaceId;
}

/**
 * Resolve the consecutive legs of one day.
 *
 * Only consecutive pairs are needed — a full N x N matrix would be N times the
 * cost for information the sequencer has already used haversine to decide.
 */
export async function resolveDayLegs(args: {
  stops: readonly RouteStop[];
  allowedModes: readonly TransportMode[];
  departAt: Date | null;
  context: { tripId: string; jobId: string };
}): Promise<readonly ResolvedLeg[]> {
  const { stops } = args;
  if (stops.length < 2) return [];

  const pairs = stops.slice(1).map((to, i) => {
    const from = stops[i] as RouteStop;
    const meters = haversineMeters(from.location, to.location);
    return { from, to, mode: inferMode(meters, args.allowedModes) as TransportMode };
  });

  const bucket = departAtBucket(args.departAt);
  const cached = await readLegCache(pairs, bucket);

  const misses = pairs.filter(
    (p) => !cached.has(legKey(p.from.placeId, p.to.placeId, p.mode)),
  );

  const measured = new Map(cached);

  // Group misses by mode: a matrix request is single-mode, and TRANSIT has a
  // tighter element cap than everything else.
  for (const [mode, group] of groupByMode(misses)) {
    for (const chunk of chunkPairs(group, maxElementsFor(mode))) {
      try {
        const legs = await computeRouteMatrix({
          origins: chunk.map((p) => p.from.location),
          destinations: chunk.map((p) => p.to.location),
          mode,
          ...(args.departAt ? { departureTime: args.departAt } : {}),
        });

        await recordApiUsage({
          provider: 'google_routes',
          sku: 'routes.routematrix.element',
          units: chunk.length * chunk.length,
          tripId: args.context.tripId,
          jobId: args.context.jobId,
        });

        // Only the diagonal matters: origin i paired with destination i.
        for (const leg of legs) {
          if (leg.originIndex !== leg.destinationIndex) continue;
          const pair = chunk[leg.originIndex];
          if (!pair) continue;
          measured.set(legKey(pair.from.placeId, pair.to.placeId, mode), {
            durationSeconds: leg.durationSeconds,
            distanceMeters: leg.distanceMeters,
          });
        }

        await writeLegCache(chunk, mode, bucket, measured);
      } catch (error) {
        // Routing is an enhancement, not a precondition. A failure degrades to
        // the haversine estimate the sequencer already used, and the UI labels
        // the leg as estimated.
        console.warn('[routing] matrix failed, falling back to estimates', error);
      }
    }
  }

  return pairs.map((pair) => {
    const hit = measured.get(legKey(pair.from.placeId, pair.to.placeId, pair.mode));
    if (hit) {
      return {
        fromPlaceId: pair.from.placeId,
        toPlaceId: pair.to.placeId,
        mode: pair.mode,
        minutes: Math.round(hit.durationSeconds / 60),
        meters: hit.distanceMeters,
        polyline: null,
        source: 'routes' as const,
      };
    }
    const meters = Math.round(haversineMeters(pair.from.location, pair.to.location));
    return {
      fromPlaceId: pair.from.placeId,
      toPlaceId: pair.to.placeId,
      mode: pair.mode,
      minutes: Math.round(estimateTravelSeconds(pair.from.location, pair.to.location, pair.mode) / 60),
      meters,
      polyline: null,
      source: 'estimated' as const,
    };
  });
}

interface Measured {
  durationSeconds: number;
  distanceMeters: number;
}

type Pair = { from: RouteStop; to: RouteStop; mode: TransportMode };

function legKey(from: PlaceId, to: PlaceId, mode: TransportMode): string {
  return `${from}|${to}|${mode}`;
}

/** Hour of week (0-167), so cached legs reflect rush hour vs Sunday morning. */
function departAtBucket(departAt: Date | null): number {
  if (!departAt) return 0;
  return departAt.getUTCDay() * 24 + departAt.getUTCHours();
}

async function readLegCache(
  pairs: readonly Pair[],
  bucket: number,
): Promise<Map<string, Measured>> {
  if (pairs.length === 0) return new Map();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('route_legs')
    .select('origin_place_id, dest_place_id, mode, duration_s, distance_m')
    .in('origin_place_id', pairs.map((p) => p.from.placeId))
    .in('dest_place_id', pairs.map((p) => p.to.placeId))
    .eq('depart_bucket', bucket)
    .gt('expires_at', new Date().toISOString());

  if (error || !data) return new Map();

  const out = new Map<string, Measured>();
  for (const row of data) {
    out.set(legKey(row.origin_place_id as PlaceId, row.dest_place_id as PlaceId, row.mode), {
      durationSeconds: row.duration_s,
      distanceMeters: row.distance_m,
    });
  }
  return out;
}

async function writeLegCache(
  pairs: readonly Pair[],
  mode: TransportMode,
  bucket: number,
  measured: ReadonlyMap<string, Measured>,
): Promise<void> {
  const now = Date.now();
  const rows = pairs.flatMap((pair) => {
    const hit = measured.get(legKey(pair.from.placeId, pair.to.placeId, mode));
    if (!hit) return [];
    return [
      {
        origin_place_id: pair.from.placeId,
        dest_place_id: pair.to.placeId,
        mode,
        depart_bucket: bucket,
        duration_s: hit.durationSeconds,
        distance_m: hit.distanceMeters,
        fetched_at: new Date(now).toISOString(),
        expires_at: new Date(now + LEG_TTL_DAYS * 86_400_000).toISOString(),
      },
    ];
  });

  if (rows.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('route_legs')
    .upsert(rows, { onConflict: 'origin_place_id,dest_place_id,mode,depart_bucket' });
  if (error) console.warn('[routing] failed to cache legs', error.message);
}

function groupByMode(pairs: readonly Pair[]): Map<TransportMode, Pair[]> {
  const out = new Map<TransportMode, Pair[]>();
  for (const pair of pairs) {
    const list = out.get(pair.mode) ?? [];
    list.push(pair);
    out.set(pair.mode, list);
  }
  return out;
}

/**
 * A square matrix of N pairs bills N^2 elements, so chunk on sqrt(limit) to stay
 * inside the cap. Transit caps at 100 elements, i.e. 10 pairs at a time.
 */
function chunkPairs(pairs: readonly Pair[], maxElements: number): Pair[][] {
  const size = Math.max(1, Math.floor(Math.sqrt(maxElements)));
  const out: Pair[][] = [];
  for (let i = 0; i < pairs.length; i += size) {
    out.push(pairs.slice(i, i + size));
  }
  return out;
}
