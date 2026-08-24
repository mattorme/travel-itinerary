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
  transit: 'by transit',
  driving: 'drive',
  rideshare: 'taxi',
  mixed: 'travel',
} as const;

/**
 * The connective tissue between stops.
 *
 * Shows how the leg was derived: a measured Google route reads plainly, an
 * estimate is labelled. Quietly claiming precision we do not have is exactly
 * the kind of thing that erodes trust in the whole itinerary.
 */
export function TravelLegRow({ leg }: { leg: TravelLeg }) {
  if (leg.minutes <= 0) return null;
  const Icon = ICONS[leg.mode] ?? Bus;
  const km = leg.meters / 1000;

  return (
    <div className="flex gap-4 pb-8">
      <div className="flex w-2.5 justify-center" aria-hidden>
        <span className="w-px flex-1 bg-line" />
      </div>
      <p className="flex items-center gap-2 text-sm text-ink-faint">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>
          {leg.minutes} min {VERBS[leg.mode] ?? 'travel'}
          {km >= 0.3 && ` · ${km.toFixed(km < 10 ? 1 : 0)} km`}
          {leg.source === 'estimated' && ' · estimated'}
        </span>
      </p>
    </div>
  );
}
