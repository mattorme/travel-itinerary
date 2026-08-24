/**
 * Field masks are the primary cost lever on the Places line.
 *
 * Places (New) bills at the HIGHEST tier any requested field belongs to, so
 * adding one field from a dearer tier reprices the entire call. Discovery runs
 * over hundreds of candidates and must stay cheap; opening hours — an expensive
 * tier — are fetched once, later, for only the ~40 places that survive ranking.
 *
 * Reference: https://developers.google.com/maps/documentation/places/web-service/choose-fields
 */

/** Discovery: everything ranking needs and nothing it doesn't. */
export const SEARCH_MASK = [
  'places.id',
  'places.types',
  'places.primaryType',
  'places.location',
  'places.displayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.businessStatus',
  'nextPageToken',
].join(',');

/**
 * Hydration: the fields a trip page actually renders, plus opening hours, which
 * scheduling cannot work without. Only ever called for shortlisted places.
 */
export const DETAILS_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'primaryType',
  'rating',
  'userRatingCount',
  'priceLevel',
  'priceRange',
  'regularOpeningHours',
  'websiteUri',
  'googleMapsUri',
  'editorialSummary',
  'photos',
  'businessStatus',
].join(',');

/** Resolving a destination name to a place. The cheapest useful mask. */
export const GEOCODE_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.viewport',
  'places.types',
  'places.addressComponents',
  'places.utcOffsetMinutes',
].join(',');

export const AUTOCOMPLETE_MASK = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text',
  'suggestions.placePrediction.structuredFormat',
  'suggestions.placePrediction.types',
].join(',');
