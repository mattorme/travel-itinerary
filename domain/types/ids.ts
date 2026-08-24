/**
 * Branded identifiers. These are compile-time only — they exist so that a
 * `PlaceId` can never be silently passed where a `TripId` is expected, which is
 * the single most likely class of bug in a codebase with this many UUIDs.
 */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type TripId = Brand<string, 'TripId'>;
export type TripDayId = Brand<string, 'TripDayId'>;
export type ActivityId = Brand<string, 'ActivityId'>;
export type PlaceId = Brand<string, 'PlaceId'>;
export type GooglePlaceId = Brand<string, 'GooglePlaceId'>;
export type DestinationId = Brand<string, 'DestinationId'>;
export type ProfileId = Brand<string, 'ProfileId'>;
export type JobId = Brand<string, 'JobId'>;
/** Opaque handle for a planned-but-unfilled slot in the draft itinerary. */
export type SlotId = Brand<string, 'SlotId'>;

export const asTripId = (v: string): TripId => v as TripId;
export const asTripDayId = (v: string): TripDayId => v as TripDayId;
export const asActivityId = (v: string): ActivityId => v as ActivityId;
export const asPlaceId = (v: string): PlaceId => v as PlaceId;
export const asGooglePlaceId = (v: string): GooglePlaceId => v as GooglePlaceId;
export const asDestinationId = (v: string): DestinationId => v as DestinationId;
export const asProfileId = (v: string): ProfileId => v as ProfileId;
export const asJobId = (v: string): JobId => v as JobId;
export const asSlotId = (v: string): SlotId => v as SlotId;
