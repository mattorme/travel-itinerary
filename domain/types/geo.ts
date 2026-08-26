export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface BoundingBox {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroid(points: readonly LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const lat = toRad(p.lat);
    const lng = toRad(p.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  const n = points.length;
  x /= n;
  y /= n;
  z /= n;
  const hyp = Math.sqrt(x * x + y * y);
  if (hyp < 1e-12 && Math.abs(z) < 1e-12) return points[0] ?? null;
  return {
    lat: (Math.atan2(z, hyp) * 180) / Math.PI,
    lng: (Math.atan2(y, x) * 180) / Math.PI,
  };
}


/**
 * Straight-line travel time used during draft iteration so the pipeline never
 * pays for a Routes call it is about to throw away. Detour factors are the ratio
 * of real network distance to great-circle distance in a typical dense city.
 */
const SPEED_MPS: Record<string, number> = {
  walking: 1.25,
  cycling: 3.9,
  transit: 6.4,
  driving: 7.5,
  rideshare: 7.5,
  mixed: 5.5,
};
const DETOUR_FACTOR: Record<string, number> = {
  walking: 1.35,
  cycling: 1.3,
  transit: 1.45,
  driving: 1.4,
  rideshare: 1.4,
  mixed: 1.4,
};
/** Fixed overhead: waiting for a train, hailing a car, parking. Seconds. */
const MODE_OVERHEAD_S: Record<string, number> = {
  walking: 0,
  cycling: 120,
  transit: 420,
  driving: 300,
  rideshare: 300,
  mixed: 300,
};

export function estimateTravelSeconds(a: LatLng, b: LatLng, mode: string): number {
  const straight = haversineMeters(a, b);
  if (straight < 40) return 0;
  const speed = SPEED_MPS[mode] ?? SPEED_MPS.mixed!;
  const detour = DETOUR_FACTOR[mode] ?? DETOUR_FACTOR.mixed!;
  const overhead = straight < 600 ? 0 : (MODE_OVERHEAD_S[mode] ?? 0);
  return Math.round((straight * detour) / speed + overhead);
}

/**
 * Pick a plausible mode for a leg when the traveller said "mixed". Short hops
 * are walked; medium distances take transit if it is available to them.
 */
export function inferMode(
  meters: number,
  allowed: readonly string[],
): string {
  const has = (m: string): boolean => allowed.includes(m) || allowed.includes('mixed');
  if (meters <= 1200 && has('walking')) return 'walking';
  if (meters <= 25_000 && has('transit')) return 'transit';
  if (has('driving')) return 'driving';
  if (has('rideshare')) return 'rideshare';
  if (has('transit')) return 'transit';
  return 'walking';
}
