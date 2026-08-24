import type { PriceLevel } from '../types/itinerary';
import type {
  AccommodationKind,
  ExperienceTag,
  Pace,
  TransportMode,
  TravelStyle,
} from '../types/taxonomy';

/**
 * The cost model.
 *
 * Google returns a price *level* (an enum) and sometimes a price range. It does
 * not return admission prices, transit fares, or nightly rates. Every currency
 * figure this product shows is therefore modelled here, not fetched — which is
 * why the UI must always say "estimated" and why this file is unit-tested
 * against known destinations.
 *
 * All figures are USD at a cost_index of 1.0 (roughly a mid-tier Western
 * European city) and are converted for display.
 */

export interface CostInputs {
  readonly costIndex: number;
  readonly style: TravelStyle;
  readonly pace: Pace;
  readonly adults: number;
  readonly children: readonly number[];
  readonly accommodation: AccommodationKind | null;
  readonly nights: number;
}

/** Per-night, per-room. Style drives the band; cost index scales it. */
const ACCOMMODATION_BASE_USD: Record<AccommodationKind, number> = {
  hostel: 34,
  budget_hotel: 72,
  apartment: 118,
  hotel: 155,
  boutique: 225,
  resort: 300,
  luxury: 460,
};

const STYLE_DEFAULT_ACCOMMODATION: Record<TravelStyle, AccommodationKind> = {
  backpacker: 'hostel',
  budget: 'budget_hotel',
  mid_range: 'hotel',
  balanced: 'hotel',
  luxury: 'luxury',
};

/** Party of 2 shares a room; beyond that we assume a second room per 2 adults. */
export function roomsFor(adults: number, children: readonly number[]): number {
  const occupants = adults + children.filter((age) => age >= 6).length;
  return Math.max(1, Math.ceil(occupants / 2));
}

export function accommodationPerNightUsd(input: CostInputs): number {
  const kind = input.accommodation ?? STYLE_DEFAULT_ACCOMMODATION[input.style];
  const base = ACCOMMODATION_BASE_USD[kind];
  return base * input.costIndex * roomsFor(input.adults, input.children);
}

/**
 * Per-person meal cost by the venue's Google price level. When a place has no
 * price level (very common outside major cities) we fall back to the traveller's
 * style, which is a better guess than assuming mid-range.
 */
const MEAL_BY_PRICE_LEVEL: Record<PriceLevel, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 11,
  PRICE_LEVEL_MODERATE: 26,
  PRICE_LEVEL_EXPENSIVE: 58,
  PRICE_LEVEL_VERY_EXPENSIVE: 115,
};

const MEAL_BY_STYLE: Record<TravelStyle, number> = {
  backpacker: 9,
  budget: 15,
  mid_range: 30,
  balanced: 26,
  luxury: 78,
};

/** Breakfast and coffee are cheaper than the venue's headline band. */
const MEAL_TAG_MULTIPLIER: Partial<Record<ExperienceTag, number>> = {
  breakfast: 0.55,
  coffee: 0.3,
  street_food: 0.4,
  lunch: 0.75,
  dinner: 1,
};

export function mealCostUsd(
  tag: ExperienceTag,
  priceLevel: PriceLevel | null,
  input: CostInputs,
): number {
  const perPerson = priceLevel !== null ? MEAL_BY_PRICE_LEVEL[priceLevel] : MEAL_BY_STYLE[input.style];
  const multiplier = MEAL_TAG_MULTIPLIER[tag] ?? 0.8;
  // Under-6s generally eat off a parent's plate; 6+ counts as a diner at ~60%.
  const diners = input.adults + input.children.filter((a) => a >= 6).length * 0.6;
  return perPerson * multiplier * input.costIndex * diners;
}

/**
 * Typical admission by experience type. These are the figures a traveller would
 * recognise: a major museum is not the same as a neighbourhood walk.
 */
const ADMISSION_BASE_USD: Partial<Record<ExperienceTag, number>> = {
  museum: 18,
  gallery: 14,
  temple_shrine: 5,
  historic_site: 15,
  landmark: 12,
  viewpoint: 20,
  aquarium_zoo: 28,
  theme_park: 75,
  workshop_class: 62,
  spa_wellness: 55,
  boat_tour: 40,
  sports_venue: 45,
  live_music: 30,
  day_trip: 70,
  hike: 0,
  park_garden: 3,
  market: 0,
  neighbourhood_walk: 0,
  shopping_street: 0,
  beach: 0,
  nature_reserve: 8,
  scenic_drive: 0,
  bar: 22,
  nightlife_district: 30,
  boutique_shopping: 0,
};

export function admissionCostUsd(tag: ExperienceTag, input: CostInputs): number {
  const base = ADMISSION_BASE_USD[tag] ?? 10;
  if (base === 0) return 0;
  // Children are typically 50-60% of adult admission.
  const payingChildren = input.children.filter((a) => a >= 4).length;
  return base * input.costIndex * (input.adults + payingChildren * 0.55);
}

/** Local transport, priced from the distance actually routed that day. */
const TRANSPORT_PER_KM_USD: Record<TransportMode, number> = {
  walking: 0,
  cycling: 0.15,
  transit: 0.18,
  driving: 0.42,
  rideshare: 1.35,
  mixed: 0.3,
};
const TRANSPORT_BOARDING_USD: Record<TransportMode, number> = {
  walking: 0,
  cycling: 1.2,
  transit: 1.5,
  driving: 0,
  rideshare: 3.2,
  mixed: 1.4,
};

export function legCostUsd(mode: TransportMode, meters: number, input: CostInputs): number {
  if (mode === 'walking' || meters <= 0) return 0;
  const travellers = input.adults + input.children.length;
  // A car or a rideshare is priced per vehicle; transit is priced per head.
  const multiplier = mode === 'driving' || mode === 'rideshare' ? 1 : travellers;
  const fare =
    TRANSPORT_BOARDING_USD[mode] + (TRANSPORT_PER_KM_USD[mode] * meters) / 1000;
  return fare * multiplier * input.costIndex;
}

/**
 * Contingency. A packed schedule leaks money (extra coffees, an unplanned taxi
 * when you are running late); a luxury traveller's unplanned spending is larger
 * in absolute terms.
 */
const PACE_BUFFER: Record<Pace, number> = { relaxed: 0.06, balanced: 0.09, packed: 0.13 };
const STYLE_BUFFER: Record<TravelStyle, number> = {
  backpacker: 0.05,
  budget: 0.06,
  mid_range: 0.09,
  balanced: 0.09,
  luxury: 0.14,
};

export function bufferRate(input: CostInputs): number {
  return PACE_BUFFER[input.pace] + STYLE_BUFFER[input.style];
}
