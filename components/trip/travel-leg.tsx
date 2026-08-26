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
 * The connection between two stops.
 *
 * Sits on the rail itself, the way a transit diagram shows the run between
 * stations. It states how the leg was derived: a measured Google route reads
 * plainly, an estimate is labelled — quietly claiming precision we do not have
 * is what erodes trust in the whole itinerary.
 */
export function TravelLegRow({ leg, routeColour }: { leg: TravelLeg; routeColour: string }) {
  if (leg.minutes <= 0) return null;
  const Icon = ICONS[leg.mode] ?? Bus;
  const km = leg.meters / 1000;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 pb-9 sm:grid-cols-[4rem_auto_1fr] sm:gap-x-5">
      <span className="hidden sm:block" aria-hidden />
      <div className="flex justify-center sm:col-start-2" aria-hidden>
        <span
          className="w-[var(--rail-width)] flex-1"
          style={{ backgroundColor: routeColour, opacity: 0.4 }}
        />
      </div>
      <p className="type-data flex items-center gap-2 text-[0.8125rem] text-steel-2 sm:col-start-3">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>
          {leg.minutes} min {VERBS[leg.mode] ?? 'travel'}
          {km >= 0.3 && ` · ${km.toFixed(km < 10 ? 1 : 0)} km`}
          {leg.source === 'estimated' && ' · est.'}
        </span>
      </p>
    </div>
  );
}
