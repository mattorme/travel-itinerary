import { describe, expect, it } from 'vitest';
import {
  bayesianRating,
  priceFit,
  proximityScore,
  rankCandidates,
  scoreCandidate,
  type RankableCandidate,
  type RankingContext,
} from '@/domain/ranking/rank';

const TOKYO = { lat: 35.6812, lng: 139.7671 };

function candidate(overrides: Partial<RankableCandidate> = {}): RankableCandidate {
  return {
    id: 'c1',
    location: TOKYO,
    rating: 4.4,
    userRatingCount: 900,
    priceLevel: 'PRICE_LEVEL_MODERATE',
    tags: ['dinner'],
    hasEditorialSummary: false,
    ourSignal: 0,
    ...overrides,
  };
}

function context(overrides: Partial<RankingContext> = {}): RankingContext {
  return {
    tag: 'dinner',
    dayCentre: TOKYO,
    style: 'balanced',
    minReviews: 200,
    excludedIds: new Set(),
    ...overrides,
  };
}

describe('bayesianRating', () => {
  it('discounts a perfect score from a handful of reviews', () => {
    const shaky = bayesianRating(5.0, 3);
    const solid = bayesianRating(4.6, 8000);
    expect(solid).toBeGreaterThan(shaky);
  });

  it('converges on the raw rating as reviews accumulate', () => {
    expect(bayesianRating(4.8, 100_000)).toBeCloseTo(4.8, 1);
  });

  it('falls back to the prior when there is no rating at all', () => {
    expect(bayesianRating(null, null)).toBeCloseTo(4.1, 5);
    expect(bayesianRating(4.9, 0)).toBeCloseTo(4.1, 5);
  });
});

describe('priceFit', () => {
  it('matches a backpacker to cheap places and a luxury traveller to expensive ones', () => {
    expect(priceFit('PRICE_LEVEL_INEXPENSIVE', 'backpacker')).toBeGreaterThan(
      priceFit('PRICE_LEVEL_VERY_EXPENSIVE', 'backpacker'),
    );
    expect(priceFit('PRICE_LEVEL_EXPENSIVE', 'luxury')).toBeGreaterThan(
      priceFit('PRICE_LEVEL_INEXPENSIVE', 'luxury'),
    );
  });

  it('stays neutral rather than penalising an unknown price level', () => {
    // Price level coverage is patchy outside major cities; penalising absence
    // would quietly gut the itinerary everywhere else.
    const unknown = priceFit(null, 'balanced');
    expect(unknown).toBeGreaterThan(0.4);
    expect(unknown).toBeLessThan(0.8);
  });
});

describe('proximityScore', () => {
  it('decays with distance rather than cutting off', () => {
    const near = proximityScore({ lat: 35.685, lng: 139.77 }, TOKYO);
    const mid = proximityScore({ lat: 35.72, lng: 139.82 }, TOKYO);
    const far = proximityScore({ lat: 36.2, lng: 140.4 }, TOKYO);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it('is neutral when the day has no centre yet', () => {
    expect(proximityScore(TOKYO, null)).toBe(0.6);
  });
});

describe('scoreCandidate', () => {
  it('prefers a nearby good place over a distant slightly better one', () => {
    // The rule that keeps a day geographically coherent.
    const nearby = scoreCandidate(
      candidate({ id: 'near', rating: 4.3, location: { lat: 35.684, lng: 139.77 } }),
      context(),
    );
    const distant = scoreCandidate(
      candidate({ id: 'far', rating: 4.6, location: { lat: 35.83, lng: 139.99 } }),
      context(),
    );
    expect(nearby.score).toBeGreaterThan(distant.score);
  });

  it('trusts a well-reviewed place more than a thinly-reviewed one', () => {
    const many = scoreCandidate(candidate({ userRatingCount: 3000 }), context());
    const few = scoreCandidate(candidate({ userRatingCount: 12 }), context());
    expect(many.score).toBeGreaterThan(few.score);
  });

  it('does not exclude obscure places outright', () => {
    // A hard review floor would empty the itinerary in cities where nothing has
    // 500 reviews. Confidence is a multiplier, not a filter.
    const obscure = scoreCandidate(candidate({ userRatingCount: 5 }), context());
    expect(obscure.score).toBeGreaterThan(0);
  });

  it('rewards a place that also carries the tag being searched for', () => {
    const onTag = scoreCandidate(candidate({ tags: ['dinner'] }), context());
    const offTag = scoreCandidate(candidate({ tags: ['museum'] }), context());
    expect(onTag.score).toBeGreaterThan(offTag.score);
  });

  it('keeps every component inside 0..1', () => {
    const scored = scoreCandidate(
      candidate({ rating: 5, userRatingCount: 999_999, ourSignal: 42 }),
      context(),
    );
    for (const value of Object.values(scored.components)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('rankCandidates', () => {
  it('returns results in descending score order', () => {
    const ranked = rankCandidates(
      Array.from({ length: 10 }, (_, i) =>
        candidate({ id: `c${i}`, rating: 3.5 + i * 0.15, userRatingCount: 500 + i * 100 }),
      ),
      context(),
    );
    const scores = ranked.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('never returns a place already used elsewhere in the trip', () => {
    const ranked = rankCandidates(
      [candidate({ id: 'used' }), candidate({ id: 'fresh' })],
      context({ excludedIds: new Set(['used']) }),
    );
    expect(ranked.map((r) => r.id)).toEqual(['fresh']);
  });

  it('caps the shortlist so the prompt stays small', () => {
    const ranked = rankCandidates(
      Array.from({ length: 40 }, (_, i) => candidate({ id: `c${i}` })),
      context(),
      6,
    );
    expect(ranked).toHaveLength(6);
  });

  it('copes with an empty pool', () => {
    expect(rankCandidates([], context())).toEqual([]);
  });
});
