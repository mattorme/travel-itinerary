import type { LatLng } from '@/domain/types/geo';
import type { DestinationId, PlaceId } from '@/domain/types/ids';
import type { OpeningHours, TravelLeg } from '@/domain/types/itinerary';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import type { CostInputs } from '@/domain/cost/model';
import type { ResolvedDestination } from './destination';
import type { CoverImage } from '@/lib/images/types';

/**
 * The pipeline's working representation.
 *
 * Distinct from the domain `Itinerary` on purpose: a draft carries generation-
 * time context (slot ids, opening hours, USD costs) that has no business being
 * persisted or rendered. `persist.ts` is the only place that converts one to the
 * other, so the extra fields cannot leak into the product.
 */

export interface DraftActivity {
  readonly slotId: string;
  readonly orderIndex: number;
  readonly kind: 'activity' | 'meal';
  readonly tag: ExperienceTag;
  readonly placeId: PlaceId;
  readonly googlePlaceId: string;
  readonly location: LatLng;
  readonly openingHours: OpeningHours | null;
  readonly title: string;
  readonly description: string;
  readonly reason: string;
  readonly durationMinutes: number;
  readonly targetMinute: number;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  /** USD at the destination's cost index. Converted once, at persist time. */
  readonly estimatedCostUsd: number;
  readonly inboundTravel: TravelLeg | null;
  readonly bookingUrl: string | null;
  readonly websiteUri: string | null;
}

export interface DraftDay {
  readonly dayIndex: number;
  readonly date: string | null;
  readonly title: string;
  readonly summary: string;
  readonly destinationId: DestinationId;
  readonly activities: readonly DraftActivity[];
  /**
   * Slots we could not fill. Surfaced honestly in the UI rather than hidden —
   * "we couldn't fit the Ghibli Museum, it books out months ahead" is useful.
   */
  readonly unfilledSlots: readonly { slotId: string; why: string }[];
}

export interface DraftItinerary {
  readonly cover: CoverImage | null;
  readonly title: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly destination: ResolvedDestination;
  readonly days: readonly DraftDay[];
  readonly costInputs: CostInputs;
}
