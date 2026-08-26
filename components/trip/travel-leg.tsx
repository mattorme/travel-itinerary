import { Bike, Bus, Car, Footprints } from 'lucide-react';
import type { TravelLeg } from '@/domain/types/itinerary';

const ICONS = {
  walking: Footprints,
  cycling: Bike,
  transit: Bus,
  driving: Car,
  rideshare: Car,
  mixed: Bus,
} as const;

const VERBS = {
  walking: 'walk',
  cycling: 'ride',
  transit: 'transit',
  driving: 'drive',
  rideshare: 'taxi',
  mixed: 'travel',
} as const;

/**
 * The gap between two stops.
 *
 * Set in the margin between cards, where the time it takes actually is. It
 * states how the leg was derived: a measured Google route reads plainly, an
 * estimate is labelled — quietly claiming precision we do not have is what
 * erodes trust in the whole itinerary.
 */
export function TravelLegRow({ leg }: { leg: TravelLeg }) {
  if (leg.minutes <= 0) return null;
  const Icon = ICONS[leg.mode] ?? Bus;
  const km = leg.meters / 1000;

  return (
    <p className="type-data flex items-center gap-2 py-3 pl-5 text-[0.8125rem] text-steel-2">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>
        {leg.minutes} min {VERBS[leg.mode] ?? 'travel'}
        {km >= 0.3 && ` · ${km.toFixed(km < 10 ? 1 : 0)} km`}
        {leg.source === 'estimated' && ' · est.'}
      </span>
    </p>
  );
}
