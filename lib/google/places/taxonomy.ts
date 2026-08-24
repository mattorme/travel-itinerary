import type { ExperienceTag } from '@/domain/types/taxonomy';

/**
 * Bridge between our experience taxonomy and Google's.
 *
 * Two directions, and they are not inverses:
 *  - `SEARCH_SPEC` drives discovery: what to ask Google for, in the traveller's
 *    language, when we want "somewhere for dinner" or "a good viewpoint".
 *  - `tagsForGoogleTypes` classifies a result we already have, so a place found
 *    under one tag can still satisfy an interest that maps to another.
 */

export interface SearchSpec {
  /** Google `includedTypes` for Nearby Search. */
  readonly includedTypes: readonly string[];
  /** Text Search query template; `{place}` is replaced with the destination. */
  readonly textQuery: string | null;
  /** Typical visit length, minutes. Overridden per-place when we know better. */
  readonly durationMinutes: number;
  /** Minimum reviews before we trust a rating for this category. */
  readonly minReviews: number;
}

export const SEARCH_SPEC: Readonly<Record<ExperienceTag, SearchSpec>> = {
  landmark: { includedTypes: ['tourist_attraction', 'monument'], textQuery: 'famous landmarks in {place}', durationMinutes: 60, minReviews: 300 },
  museum: { includedTypes: ['museum'], textQuery: 'best museums in {place}', durationMinutes: 120, minReviews: 200 },
  gallery: { includedTypes: ['art_gallery'], textQuery: 'art galleries in {place}', durationMinutes: 90, minReviews: 60 },
  temple_shrine: { includedTypes: ['hindu_temple', 'church', 'mosque', 'synagogue', 'place_of_worship'], textQuery: 'historic temples and shrines in {place}', durationMinutes: 60, minReviews: 100 },
  historic_site: { includedTypes: ['historical_landmark', 'historical_place'], textQuery: 'historic sites in {place}', durationMinutes: 90, minReviews: 150 },
  neighbourhood_walk: { includedTypes: ['neighborhood'], textQuery: 'best neighbourhoods to walk around in {place}', durationMinutes: 90, minReviews: 0 },
  market: { includedTypes: ['market'], textQuery: 'local markets in {place}', durationMinutes: 75, minReviews: 100 },
  park_garden: { includedTypes: ['park', 'garden', 'botanical_garden'], textQuery: 'beautiful parks and gardens in {place}', durationMinutes: 75, minReviews: 100 },
  viewpoint: { includedTypes: ['observation_deck'], textQuery: 'best viewpoints in {place}', durationMinutes: 60, minReviews: 150 },
  nature_reserve: { includedTypes: ['national_park', 'wildlife_park'], textQuery: 'nature reserves near {place}', durationMinutes: 180, minReviews: 80 },
  hike: { includedTypes: ['hiking_area'], textQuery: 'best hikes near {place}', durationMinutes: 240, minReviews: 40 },
  beach: { includedTypes: ['beach'], textQuery: 'best beaches near {place}', durationMinutes: 180, minReviews: 60 },
  breakfast: { includedTypes: ['breakfast_restaurant', 'brunch_restaurant', 'bakery'], textQuery: 'best breakfast in {place}', durationMinutes: 60, minReviews: 100 },
  lunch: { includedTypes: ['restaurant'], textQuery: 'best lunch spots in {place}', durationMinutes: 75, minReviews: 150 },
  dinner: { includedTypes: ['restaurant', 'fine_dining_restaurant'], textQuery: 'best dinner restaurants in {place}', durationMinutes: 105, minReviews: 200 },
  coffee: { includedTypes: ['coffee_shop', 'cafe'], textQuery: 'best coffee in {place}', durationMinutes: 45, minReviews: 80 },
  street_food: { includedTypes: ['food_court', 'meal_takeaway'], textQuery: 'best street food in {place}', durationMinutes: 60, minReviews: 100 },
  bar: { includedTypes: ['bar', 'wine_bar'], textQuery: 'best bars in {place}', durationMinutes: 90, minReviews: 120 },
  live_music: { includedTypes: ['concert_hall', 'night_club'], textQuery: 'live music venues in {place}', durationMinutes: 150, minReviews: 60 },
  shopping_street: { includedTypes: ['shopping_mall'], textQuery: 'best shopping streets in {place}', durationMinutes: 105, minReviews: 200 },
  boutique_shopping: { includedTypes: ['clothing_store', 'book_store'], textQuery: 'independent boutiques in {place}', durationMinutes: 75, minReviews: 40 },
  workshop_class: { includedTypes: ['tourist_attraction'], textQuery: 'cooking classes and craft workshops in {place}', durationMinutes: 180, minReviews: 30 },
  day_trip: { includedTypes: ['tourist_attraction'], textQuery: 'best day trips from {place}', durationMinutes: 420, minReviews: 150 },
  spa_wellness: { includedTypes: ['spa', 'wellness_center'], textQuery: 'best spas in {place}', durationMinutes: 120, minReviews: 60 },
  sports_venue: { includedTypes: ['stadium', 'arena'], textQuery: 'sports stadiums in {place}', durationMinutes: 180, minReviews: 200 },
  aquarium_zoo: { includedTypes: ['aquarium', 'zoo'], textQuery: 'aquariums and zoos in {place}', durationMinutes: 150, minReviews: 200 },
  theme_park: { includedTypes: ['amusement_park'], textQuery: 'theme parks in {place}', durationMinutes: 420, minReviews: 300 },
  scenic_drive: { includedTypes: ['tourist_attraction'], textQuery: 'scenic drives near {place}', durationMinutes: 180, minReviews: 40 },
  boat_tour: { includedTypes: ['marina'], textQuery: 'boat tours in {place}', durationMinutes: 150, minReviews: 60 },
  nightlife_district: { includedTypes: ['night_club'], textQuery: 'nightlife districts in {place}', durationMinutes: 150, minReviews: 100 },
};

/** Google type -> our tags. A place usually earns several. */
const TYPE_TO_TAGS: Readonly<Record<string, readonly ExperienceTag[]>> = {
  tourist_attraction: ['landmark'],
  monument: ['landmark', 'historic_site'],
  museum: ['museum'],
  art_gallery: ['gallery'],
  historical_landmark: ['historic_site', 'landmark'],
  historical_place: ['historic_site'],
  hindu_temple: ['temple_shrine'],
  buddhist_temple: ['temple_shrine'],
  church: ['temple_shrine'],
  mosque: ['temple_shrine'],
  synagogue: ['temple_shrine'],
  place_of_worship: ['temple_shrine'],
  park: ['park_garden'],
  garden: ['park_garden'],
  botanical_garden: ['park_garden'],
  national_park: ['nature_reserve'],
  wildlife_park: ['nature_reserve'],
  hiking_area: ['hike'],
  beach: ['beach'],
  observation_deck: ['viewpoint'],
  market: ['market'],
  restaurant: ['lunch', 'dinner'],
  fine_dining_restaurant: ['dinner'],
  breakfast_restaurant: ['breakfast'],
  brunch_restaurant: ['breakfast'],
  bakery: ['breakfast', 'coffee'],
  coffee_shop: ['coffee'],
  cafe: ['coffee'],
  food_court: ['street_food'],
  meal_takeaway: ['street_food'],
  bar: ['bar'],
  wine_bar: ['bar'],
  night_club: ['nightlife_district', 'live_music'],
  concert_hall: ['live_music'],
  shopping_mall: ['shopping_street'],
  clothing_store: ['boutique_shopping'],
  book_store: ['boutique_shopping'],
  spa: ['spa_wellness'],
  wellness_center: ['spa_wellness'],
  stadium: ['sports_venue'],
  arena: ['sports_venue'],
  aquarium: ['aquarium_zoo'],
  zoo: ['aquarium_zoo'],
  amusement_park: ['theme_park'],
  marina: ['boat_tour'],
  neighborhood: ['neighbourhood_walk'],
};

export function tagsForGoogleTypes(types: readonly string[]): readonly ExperienceTag[] {
  const out = new Set<ExperienceTag>();
  for (const type of types) {
    for (const tag of TYPE_TO_TAGS[type] ?? []) out.add(tag);
  }
  return [...out];
}

/**
 * Types that should never appear in an itinerary regardless of how they were
 * found. Google's `tourist_attraction` in particular is broad enough to return
 * a car park with good reviews.
 */
export const EXCLUDED_TYPES: ReadonlySet<string> = new Set([
  'lodging', 'hotel', 'motel', 'hostel', 'resort_hotel', 'guest_house',
  'parking', 'gas_station', 'atm', 'bank', 'car_rental', 'car_repair',
  'airport', 'bus_station', 'train_station', 'subway_station', 'transit_station',
  'hospital', 'pharmacy', 'doctor', 'dentist',
  'real_estate_agency', 'insurance_agency', 'storage', 'moving_company',
  'convenience_store', 'supermarket', 'grocery_store',
  'cemetery', 'funeral_home',
]);
