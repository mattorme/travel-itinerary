import { z } from 'zod';

/**
 * Wire schemas for Places API (New).
 *
 * Everything is nullable/optional on purpose: field coverage varies enormously
 * by region, and a Zod schema that assumes `rating` exists will reject perfectly
 * usable places in smaller cities. Parse defensively, degrade gracefully.
 */

export const googleLatLngSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const googleOpeningHoursSchema = z.object({
  periods: z
    .array(
      z.object({
        open: z.object({ day: z.number().int().min(0).max(6), hour: z.number().int(), minute: z.number().int() }).optional(),
        close: z.object({ day: z.number().int().min(0).max(6), hour: z.number().int(), minute: z.number().int() }).optional(),
      }),
    )
    .optional(),
  weekdayDescriptions: z.array(z.string()).optional(),
});

export const googlePlaceSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string(), languageCode: z.string().optional() }).optional(),
  formattedAddress: z.string().optional(),
  location: googleLatLngSchema.optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  priceLevel: z.string().optional(),
  priceRange: z.unknown().optional(),
  regularOpeningHours: googleOpeningHoursSchema.optional(),
  websiteUri: z.string().optional(),
  googleMapsUri: z.string().optional(),
  editorialSummary: z.object({ text: z.string() }).optional(),
  photos: z.array(z.object({ name: z.string(), widthPx: z.number().optional(), heightPx: z.number().optional() })).optional(),
  businessStatus: z.string().optional(),
  viewport: z
    .object({ low: googleLatLngSchema, high: googleLatLngSchema })
    .optional(),
  addressComponents: z
    .array(
      z.object({
        longText: z.string().optional(),
        shortText: z.string().optional(),
        types: z.array(z.string()),
      }),
    )
    .optional(),
  utcOffsetMinutes: z.number().optional(),
});

export type GooglePlace = z.infer<typeof googlePlaceSchema>;

export const searchResponseSchema = z.object({
  places: z.array(googlePlaceSchema).optional(),
  nextPageToken: z.string().optional(),
});

export const autocompleteResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: z.object({ text: z.string() }),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }).optional(),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
            types: z.array(z.string()).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});
