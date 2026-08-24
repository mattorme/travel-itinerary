import type { OpeningHours, PlaceHydration, PriceLevel } from '@/domain/types/itinerary';
import { PRICE_LEVELS } from '@/domain/types/itinerary';
import type { GooglePlace } from './types';

/**
 * Google's shape -> ours. Doing this once, here, means no other module has to
 * know that Google reports hours as {day, hour, minute} pairs or that a
 * 24-hour venue is expressed as a single period with no close.
 */

export function normalizeOpeningHours(place: GooglePlace): OpeningHours | null {
  const raw = place.regularOpeningHours;
  if (!raw?.periods || raw.periods.length === 0) return null;

  // A single open period with no close is Google's encoding for "always open".
  if (raw.periods.length === 1 && raw.periods[0]?.close === undefined) {
    return { alwaysOpen: true, periods: [] };
  }

  const periods: { day: number; open: number; close: number }[] = [];
  for (const period of raw.periods) {
    if (!period.open || !period.close) continue;
    const open = period.open.hour * 60 + period.open.minute;
    let close = period.close.hour * 60 + period.close.minute;
    // A venue closing after midnight reports the next day. Extend past 1440 so
    // comparisons stay monotonic within the opening day.
    if (period.close.day !== period.open.day || close <= open) close += 1440;
    periods.push({ day: period.open.day, open, close });
  }

  if (periods.length === 0) return null;
  return { alwaysOpen: false, periods };
}

function normalizePriceLevel(value: string | undefined): PriceLevel | null {
  if (!value) return null;
  return (PRICE_LEVELS as readonly string[]).includes(value) ? (value as PriceLevel) : null;
}

export function normalizeHydration(place: GooglePlace): PlaceHydration {
  return {
    displayName: place.displayName?.text ?? 'Unnamed place',
    formattedAddress: place.formattedAddress ?? null,
    location: place.location
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: normalizePriceLevel(place.priceLevel),
    openingHours: normalizeOpeningHours(place),
    websiteUri: place.websiteUri ?? null,
    googleMapsUri: place.googleMapsUri ?? null,
    editorialSummary: place.editorialSummary?.text ?? null,
    photoNames: place.photos?.map((p) => p.name) ?? [],
    businessStatus: place.businessStatus ?? null,
  };
}

export function countryCodeOf(place: GooglePlace): string | null {
  const component = place.addressComponents?.find((c) => c.types.includes('country'));
  return component?.shortText?.toUpperCase() ?? null;
}

export function countryNameOf(place: GooglePlace): string | null {
  const component = place.addressComponents?.find((c) => c.types.includes('country'));
  return component?.longText ?? null;
}
