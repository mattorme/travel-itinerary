import { haversineMeters, type LatLng } from '../types/geo';
import type { PriceLevel } from '../types/itinerary';
import type { ExperienceTag, TravelStyle } from '../types/taxonomy';

/**
 * Candidate ranking.
 *
 * Deterministic and pure — this is an optimisation problem with an objective
 * function, and an LLM would do it worse, non-deterministically, and for money.
 * Keeping it here also makes "why did it pick that restaurant" answerable.
 */

export interface RankableCandidate {
  readonly id: string;
  readonly location: LatLng;
  readonly rating: number | null;
  readonly userRatingCount: number | null;
  readonly priceLevel: PriceLevel | null;
  readonly tags: readonly ExperienceTag[];
  readonly hasEditorialSummary: boolean;
  /** Our own signal (clone rate, curation). Survives Google cache expiry. */
  readonly ourSignal: number;
}

export interface RankingContext {
  readonly tag: ExperienceTag;
  readonly dayCentre: LatLng | null;
  readonly style: TravelStyle;
  /** Minimum reviews before a rating is trusted for this category. */
  readonly minReviews: number;
  /** Places already used elsewhere in the trip. */
  readonly excludedIds: ReadonlySet<string>;
}

export interface ScoredCandidate {
  readonly id: string;
  readonly score: number;
  readonly components: {
    readonly quality: number;
    readonly proximity: number;
    readonly priceFit: number;
    readonly tagFit: number;
    readonly signal: number;
  };
}

/**
 * Bayesian average. A 5.0 from 3 reviews should not outrank a 4.6 from 8,000 —
 * this pulls low-volume ratings toward the category mean until they earn their
 * position.
 */
export function bayesianRating(
  rating: number | null,
  count: number | null,
  priorMean = 4.1,
  priorWeight = 120,
): number {
  if (rating === null || count === null || count === 0) return priorMean;
  return (priorMean * priorWeight + rating * count) / (priorWeight + count);
}

/** How well a venue's price band matches the traveller's stated style. */
const STYLE_TARGET_PRICE: Record<TravelStyle, number> = {
  backpacker: 1,
  budget: 1.4,
  mid_range: 2.4,
  balanced: 2.2,
  luxury: 3.6,
};

const PRICE_LEVEL_ORDINAL: Record<PriceLevel, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function priceFit(level: PriceLevel | null, style: TravelStyle): number {
  if (level === null) return 0.6; // unknown: neutral, not penalised
  const distance = Math.abs(PRICE_LEVEL_ORDINAL[level] - STYLE_TARGET_PRICE[style]);
  return Math.max(0, 1 - distance / 3);
}

/**
 * Proximity to the day's centre of gravity. Decays smoothly rather than
 * cutting off, so a genuinely exceptional place slightly further out can still
 * win — but the day stays coherent by default.
 */
export function proximityScore(location: LatLng, centre: LatLng | null): number {
  if (!centre) return 0.6;
  const km = haversineMeters(location, centre) / 1000;
  return 1 / (1 + (km / 2.5) ** 1.6);
}

const WEIGHTS = {
  quality: 0.4,
  proximity: 0.26,
  priceFit: 0.14,
  tagFit: 0.1,
  signal: 0.1,
} as const;

export function scoreCandidate(
  candidate: RankableCandidate,
  context: RankingContext,
): ScoredCandidate {
  const reviews = candidate.userRatingCount ?? 0;

  // Below the category's review floor we trust the rating much less. Applying
  // this as a multiplier rather than a filter keeps genuinely obscure-but-good
  // places reachable in cities where nothing has 500 reviews.
  const confidence = context.minReviews === 0 ? 1 : Math.min(1, reviews / context.minReviews);
  const quality =
    (bayesianRating(candidate.rating, candidate.userRatingCount) / 5) * (0.55 + 0.45 * confidence) +
    (candidate.hasEditorialSummary ? 0.04 : 0);

  const proximity = proximityScore(candidate.location, context.dayCentre);
  const price = priceFit(candidate.priceLevel, context.style);
  const tagFit = candidate.tags.includes(context.tag) ? 1 : 0.45;
  const signal = clamp01(candidate.ourSignal);

  const score =
    WEIGHTS.quality * clamp01(quality) +
    WEIGHTS.proximity * proximity +
    WEIGHTS.priceFit * price +
    WEIGHTS.tagFit * tagFit +
    WEIGHTS.signal * signal;

  return {
    id: candidate.id,
    score,
    components: { quality: clamp01(quality), proximity, priceFit: price, tagFit, signal },
  };
}

/**
 * Rank and shortlist.
 *
 * `shortlist` is what reaches the model. Kept small deliberately: a long list
 * costs input tokens and makes the choice worse, not better.
 */
export function rankCandidates(
  candidates: readonly RankableCandidate[],
  context: RankingContext,
  shortlist = 6,
): readonly ScoredCandidate[] {
  return candidates
    .filter((c) => !context.excludedIds.has(c.id))
    .map((c) => scoreCandidate(c, context))
    .sort((a, b) => b.score - a.score)
    .slice(0, shortlist);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
