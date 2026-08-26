/**
 * Our taxonomy. Deliberately separate from Google's `types` list: theirs is a
 * business classification, ours is about what a traveller is trying to do.
 * The mapping between them lives in lib/google/places/taxonomy.ts.
 */

export const INTERESTS = [
  'food',
  'nightlife',
  'history',
  'culture',
  'beaches',
  'nature',
  'hiking',
  'museums',
  'architecture',
  'shopping',
  'photography',
  'adventure',
  'local_experiences',
  'sports',
  'relaxation',
  'art',
  'music',
  'family',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const TRAVEL_STYLES = ['budget', 'backpacker', 'mid_range', 'balanced', 'luxury'] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export const PACES = ['relaxed', 'balanced', 'packed'] as const;
export type Pace = (typeof PACES)[number];

export const TRANSPORT_MODES = [
  'walking',
  'transit',
  'driving',
  'rideshare',
  'cycling',
  'mixed',
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const ACCOMMODATION_KINDS = [
  'hostel',
  'budget_hotel',
  'hotel',
  'apartment',
  'boutique',
  'resort',
  'luxury',
] as const;
export type AccommodationKind = (typeof ACCOMMODATION_KINDS)[number];

export const FOOD_PREFS = [
  'local_food',
  'street_food',
  'fine_dining',
  'cafes',
  'vegetarian',
  'vegan',
  'halal',
  'kosher',
  'gluten_free',
  'seafood',
  'no_spicy',
] as const;
export type FoodPref = (typeof FOOD_PREFS)[number];

export const ACTIVITY_KINDS = [
  'activity',
  'meal',
  'transit',
  'accommodation',
  'free_time',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * Experience tags are what the planner LLM emits and what candidate search
 * resolves against. They are intentionally coarse — a tag names a *kind of
 * afternoon*, not a specific venue.
 */
export const EXPERIENCE_TAGS = [
  'landmark',
  'museum',
  'gallery',
  'temple_shrine',
  'historic_site',
  'neighbourhood_walk',
  'market',
  'park_garden',
  'viewpoint',
  'nature_reserve',
  'hike',
  'beach',
  'breakfast',
  'lunch',
  'dinner',
  'coffee',
  'street_food',
  'bar',
  'live_music',
  'shopping_street',
  'boutique_shopping',
  'workshop_class',
  'day_trip',
  'spa_wellness',
  'sports_venue',
  'aquarium_zoo',
  'theme_park',
  'scenic_drive',
  'boat_tour',
  'nightlife_district',
] as const;
export type ExperienceTag = (typeof EXPERIENCE_TAGS)[number];

export const MEAL_TAGS: readonly ExperienceTag[] = [
  'breakfast',
  'lunch',
  'dinner',
  'coffee',
  'street_food',
];

export function isMealTag(tag: ExperienceTag): boolean {
  return MEAL_TAGS.includes(tag);
}

/** Which experience tags satisfy which stated interest. Drives INTEREST_UNMET. */
export const INTEREST_TAGS: Readonly<Record<Interest, readonly ExperienceTag[]>> = {
  food: ['lunch', 'dinner', 'street_food', 'market', 'workshop_class', 'coffee'],
  nightlife: ['bar', 'live_music', 'nightlife_district'],
  history: ['historic_site', 'temple_shrine', 'museum', 'landmark'],
  culture: ['museum', 'gallery', 'temple_shrine', 'workshop_class', 'live_music'],
  beaches: ['beach', 'boat_tour'],
  nature: ['park_garden', 'nature_reserve', 'viewpoint', 'scenic_drive'],
  hiking: ['hike', 'nature_reserve', 'viewpoint'],
  museums: ['museum', 'gallery'],
  architecture: ['landmark', 'historic_site', 'temple_shrine', 'neighbourhood_walk'],
  shopping: ['shopping_street', 'boutique_shopping', 'market'],
  photography: ['viewpoint', 'landmark', 'neighbourhood_walk', 'park_garden'],
  adventure: ['hike', 'boat_tour', 'theme_park', 'nature_reserve'],
  local_experiences: ['market', 'neighbourhood_walk', 'workshop_class', 'street_food'],
  sports: ['sports_venue'],
  relaxation: ['spa_wellness', 'park_garden', 'beach', 'coffee'],
  art: ['gallery', 'museum', 'workshop_class'],
  music: ['live_music', 'bar'],
  family: ['aquarium_zoo', 'theme_park', 'park_garden', 'museum'],
};

/**
 * Keep only the values that are actually in a taxonomy.
 *
 * `interests` and `food_prefs` are `text[]` in Postgres, not enum arrays, so a
 * row comes back as `string[]` however carefully the wizard validated it on the
 * way in. Filtering on read costs nothing on a five-element array and is honest
 * about what the database can and cannot promise — asserting the union with a
 * cast would just be a nicer-looking `any`.
 */
export function membersOf<T extends string>(
  allowed: readonly T[],
  values: readonly string[] | null | undefined,
): T[] {
  const set = new Set<string>(allowed);
  return (values ?? []).filter((value): value is T => set.has(value));
}
