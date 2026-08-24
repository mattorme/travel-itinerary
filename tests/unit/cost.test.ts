import { describe, expect, it } from 'vitest';
import {
  accommodationPerNightUsd,
  admissionCostUsd,
  bufferRate,
  legCostUsd,
  mealCostUsd,
  roomsFor,
  type CostInputs,
} from '@/domain/cost/model';
import { estimateTripCost, budgetDelta } from '@/domain/cost/estimate';
import { makeActivity, makeDay, makeItinerary } from '../fixtures/itinerary';

const base = (overrides: Partial<CostInputs> = {}): CostInputs => ({
  costIndex: 1,
  style: 'balanced',
  pace: 'balanced',
  adults: 2,
  children: [],
  accommodation: null,
  nights: 5,
  ...overrides,
});

describe('rooms', () => {
  it.each([
    [2, [], 1],
    [3, [], 2],
    [4, [], 2],
    [2, [2], 1],       // a toddler does not need another room
    [2, [8, 10], 2],   // two school-age children do
  ])('%i adults + %j children needs %i rooms', (adults, children, expected) => {
    expect(roomsFor(adults, children)).toBe(expected);
  });
});

describe('accommodation', () => {
  it('scales with the destination cost index', () => {
    const cheap = accommodationPerNightUsd(base({ costIndex: 0.4 }));
    const dear = accommodationPerNightUsd(base({ costIndex: 1.8 }));
    expect(dear / cheap).toBeCloseTo(4.5, 1);
  });

  it('a backpacker pays a fraction of a luxury traveller', () => {
    expect(accommodationPerNightUsd(base({ style: 'backpacker' })))
      .toBeLessThan(accommodationPerNightUsd(base({ style: 'luxury' })) * 0.15);
  });

  it('an explicit preference overrides the style default', () => {
    const luxuryStyleHostelStay = accommodationPerNightUsd(
      base({ style: 'luxury', accommodation: 'hostel' }),
    );
    expect(luxuryStyleHostelStay).toBe(accommodationPerNightUsd(base({ style: 'backpacker' })));
  });
});

describe('meals', () => {
  it('uses the venue price level when Google supplied one', () => {
    const cheap = mealCostUsd('dinner', 'PRICE_LEVEL_INEXPENSIVE', base());
    const dear = mealCostUsd('dinner', 'PRICE_LEVEL_VERY_EXPENSIVE', base());
    expect(dear).toBeGreaterThan(cheap * 5);
  });

  it('falls back to travel style when the price level is unknown', () => {
    // This is the common case outside major cities and must not blow up.
    expect(mealCostUsd('dinner', null, base({ style: 'backpacker' })))
      .toBeLessThan(mealCostUsd('dinner', null, base({ style: 'luxury' })));
  });

  it('prices coffee well below dinner at the same venue tier', () => {
    expect(mealCostUsd('coffee', 'PRICE_LEVEL_MODERATE', base()))
      .toBeLessThan(mealCostUsd('dinner', 'PRICE_LEVEL_MODERATE', base()) * 0.4);
  });

  it('counts an under-6 as eating off a parent plate', () => {
    expect(mealCostUsd('dinner', 'PRICE_LEVEL_MODERATE', base({ children: [3] })))
      .toBe(mealCostUsd('dinner', 'PRICE_LEVEL_MODERATE', base({ children: [] })));
  });
});

describe('admission', () => {
  it('charges nothing for things that are free', () => {
    expect(admissionCostUsd('neighbourhood_walk', base())).toBe(0);
    expect(admissionCostUsd('market', base())).toBe(0);
    expect(admissionCostUsd('beach', base())).toBe(0);
  });

  it('charges more for a theme park than a temple', () => {
    expect(admissionCostUsd('theme_park', base())).toBeGreaterThan(
      admissionCostUsd('temple_shrine', base()) * 5,
    );
  });

  it('discounts children rather than charging full price', () => {
    const withKid = admissionCostUsd('museum', base({ adults: 2, children: [9] }));
    const asThreeAdults = admissionCostUsd('museum', base({ adults: 3 }));
    expect(withKid).toBeLessThan(asThreeAdults);
  });
});

describe('local transport', () => {
  it('is free to walk', () => {
    expect(legCostUsd('walking', 3000, base())).toBe(0);
  });

  it('prices transit per head but a car per vehicle', () => {
    const solo = base({ adults: 1 });
    const four = base({ adults: 4 });
    expect(legCostUsd('transit', 8000, four)).toBeCloseTo(legCostUsd('transit', 8000, solo) * 4, 4);
    expect(legCostUsd('driving', 8000, four)).toBeCloseTo(legCostUsd('driving', 8000, solo), 4);
  });

  it('makes a rideshare markedly dearer than transit', () => {
    expect(legCostUsd('rideshare', 8000, base())).toBeGreaterThan(
      legCostUsd('transit', 8000, base()) * 2,
    );
  });
});

describe('buffer', () => {
  it('is larger for a packed luxury trip than a relaxed backpacking one', () => {
    expect(bufferRate(base({ pace: 'packed', style: 'luxury' })))
      .toBeGreaterThan(bufferRate(base({ pace: 'relaxed', style: 'backpacker' })));
  });
});

describe('estimateTripCost', () => {
  it('sums per-activity costs into the right buckets', () => {
    const day = makeDay({
      activities: [
        makeActivity({ kind: 'meal', estimatedCost: 40 }),
        makeActivity({ kind: 'activity', estimatedCost: 25 }),
      ],
    });
    const { breakdown, perDay } = estimateTripCost([day], base({ nights: 1 }), 1);
    expect(breakdown.food).toBe(40);
    expect(breakdown.activities).toBe(25);
    expect(perDay[0]!.total).toBe(65);
  });

  it('always declares that flights are excluded', () => {
    const { breakdown } = estimateTripCost([], base(), 1);
    expect(breakdown.excludesFlights).toBe(true);
  });

  it('applies the FX rate to the accommodation line', () => {
    const usd = estimateTripCost([], base({ nights: 2 }), 1).breakdown.accommodation;
    const aud = estimateTripCost([], base({ nights: 2 }), 1.5).breakdown.accommodation;
    expect(aud).toBeCloseTo(usd * 1.5, 1);
  });

  it('adds a buffer on top of the subtotal', () => {
    const { breakdown } = estimateTripCost(
      [makeDay({ activities: [makeActivity({ estimatedCost: 100 })] })],
      base({ nights: 0 }),
      1,
    );
    expect(breakdown.buffer).toBeGreaterThan(0);
    expect(breakdown.total).toBeGreaterThan(breakdown.activities);
  });
});

describe('budgetDelta', () => {
  it('is null when no budget was given', () => {
    expect(budgetDelta(makeItinerary())).toBeNull();
  });

  it('reports the overspend as an absolute and a ratio', () => {
    const trip = makeItinerary({
      request: { ...makeItinerary().request, budgetTotal: 1000 },
      estimatedCost: {
        accommodation: 0, food: 0, activities: 1200, localTransport: 0,
        buffer: 0, total: 1200, excludesFlights: true,
      },
    });
    expect(budgetDelta(trip)).toEqual({ absolute: 200, ratio: 0.2 });
  });
});
