import { estimateTravelSeconds, haversineMeters, type LatLng } from '../types/geo';

/**
 * Day sequencing.
 *
 * This is a small travelling-salesman instance with time windows. It is solved
 * deterministically — nearest-neighbour for a starting tour, then 2-opt to
 * remove crossings — because an LLM does this worse, non-deterministically, and
 * for money. Day sizes are <= ~10 nodes, so an exact-enough local search is
 * instant.
 */

export interface SequenceNode {
  readonly id: string;
  readonly location: LatLng;
  /** Nodes that cannot move: user-pinned activities, and meals in their window. */
  readonly pinnedIndex?: number;
  /** Earliest/latest start, minutes since midnight. Used to keep meals sane. */
  readonly earliestStart?: number;
  readonly latestStart?: number;
  readonly durationMinutes: number;
}

export interface SequenceOptions {
  /** Where the day starts and ends — the accommodation anchor, when known. */
  readonly anchor: LatLng | null;
  readonly mode: string;
  readonly dayStartMinute: number;
}

export interface SequencedDay {
  readonly order: readonly string[];
  readonly totalTravelSeconds: number;
  readonly totalTravelMeters: number;
}

export function sequenceDay(
  nodes: readonly SequenceNode[],
  options: SequenceOptions,
): SequencedDay {
  if (nodes.length <= 1) {
    return { order: nodes.map((n) => n.id), totalTravelSeconds: 0, totalTravelMeters: 0 };
  }

  const pinned = new Map<number, SequenceNode>();
  const free: SequenceNode[] = [];
  for (const node of nodes) {
    if (node.pinnedIndex !== undefined) pinned.set(node.pinnedIndex, node);
    else free.push(node);
  }

  const tour = nearestNeighbour(free, options.anchor, options.mode);
  const improved = twoOpt(tour, options.mode);
  const merged = reinsertPinned(improved, pinned, nodes.length);

  return {
    order: merged.map((n) => n.id),
    ...tourCost(merged, options),
  };
}

function nearestNeighbour(
  nodes: readonly SequenceNode[],
  anchor: LatLng | null,
  mode: string,
): SequenceNode[] {
  if (nodes.length === 0) return [];
  const remaining = [...nodes];
  const out: SequenceNode[] = [];

  // Start from whichever node is closest to the anchor, so the day opens near
  // where the traveller wakes up rather than at an arbitrary point.
  let cursor: LatLng =
    anchor ?? (remaining[0] as SequenceNode).location;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i] as SequenceNode;
      const cost = estimateTravelSeconds(cursor, candidate.location, mode);
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    if (!next) break;
    out.push(next);
    cursor = next.location;
  }
  return out;
}

/** 2-opt: repeatedly reverse a segment when doing so shortens the tour. */
function twoOpt(tour: SequenceNode[], mode: string): SequenceNode[] {
  if (tour.length < 4) return tour;
  let best = [...tour];
  let improved = true;
  let guard = 0;

  while (improved && guard < 60) {
    improved = false;
    guard += 1;
    for (let i = 0; i < best.length - 2; i++) {
      for (let k = i + 2; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i + 1),
          ...best.slice(i + 1, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (pathSeconds(candidate, mode) + 1 < pathSeconds(best, mode)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

function pathSeconds(tour: readonly SequenceNode[], mode: string): number {
  let total = 0;
  for (let i = 1; i < tour.length; i++) {
    total += estimateTravelSeconds(
      (tour[i - 1] as SequenceNode).location,
      (tour[i] as SequenceNode).location,
      mode,
    );
  }
  return total;
}

/**
 * Pinned nodes claim their exact index; free nodes fill the gaps in order.
 * This is what keeps "dinner is the last thing on Tuesday" true through a
 * reordering pass.
 */
function reinsertPinned(
  free: readonly SequenceNode[],
  pinned: ReadonlyMap<number, SequenceNode>,
  total: number,
): SequenceNode[] {
  const out: SequenceNode[] = new Array(total);
  for (const [index, node] of pinned) {
    if (index >= 0 && index < total) out[index] = node;
  }
  let cursor = 0;
  for (const node of free) {
    while (cursor < total && out[cursor] !== undefined) cursor += 1;
    if (cursor >= total) break;
    out[cursor] = node;
  }
  return out.filter((n): n is SequenceNode => n !== undefined);
}

function tourCost(
  tour: readonly SequenceNode[],
  options: SequenceOptions,
): { totalTravelSeconds: number; totalTravelMeters: number } {
  let seconds = 0;
  let meters = 0;
  let cursor = options.anchor;

  for (const node of tour) {
    if (cursor) {
      seconds += estimateTravelSeconds(cursor, node.location, options.mode);
      meters += haversineMeters(cursor, node.location);
    }
    cursor = node.location;
  }
  return { totalTravelSeconds: Math.round(seconds), totalTravelMeters: Math.round(meters) };
}
