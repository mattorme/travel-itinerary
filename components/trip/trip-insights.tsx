import { Footprints, Gauge, MapPin, Wallet } from 'lucide-react';
import type { Itinerary } from '@/domain/types/itinerary';
import { computeInsights, metersToSteps } from '@/domain/insights/insights';
import { formatDuration } from '@/lib/utils/format';

/**
 * At a glance.
 *
 * A list of stops does not tell anyone whether a trip is a gentle week or a
 * forced march, and that is usually the first thing they want to know. Four
 * numbers, chosen because each one changes a decision: how far you walk, how
 * much of the day is spoken for, how many distinct places, and how much of it
 * costs nothing.
 *
 * Deliberately a strip and not a dashboard. The itinerary is the page.
 */
export function TripInsights({ itinerary }: { itinerary: Itinerary }) {
  const insights = computeInsights(itinerary);
  if (insights.isEmpty) return null;

  const days = Math.max(1, itinerary.days.length);
  const walkPerDay = insights.walkingMeters / days;
  const activePerDay = Math.round(insights.activeMinutes / days);

  const stats: { icon: typeof Footprints; value: string; label: string }[] = [
    {
      icon: MapPin,
      value: String(insights.distinctPlaces || insights.stops),
      label: insights.stops === 1 ? 'place' : 'places',
    },
    {
      icon: Footprints,
      value: walkPerDay >= 100 ? `${(walkPerDay / 1000).toFixed(1)} km` : '—',
      label: 'walking a day',
    },
    {
      icon: Gauge,
      value: formatDuration(activePerDay),
      label: 'planned a day',
    },
    {
      icon: Wallet,
      value: `${Math.round(insights.freeStopShare * 100)}%`,
      label: 'costs nothing',
    },
  ];

  return (
    <section aria-label="At a glance" className="mt-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-rule shadow-(--shadow-card) sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-4">
            <dt className="flex items-center gap-1.5 text-xs text-steel-2">
              <stat.icon className="size-3.5" aria-hidden />
              {stat.label}
            </dt>
            <dd className="mt-1 type-display text-2xl tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {insights.busiestDay && insights.lightestDay && (
        <p className="mt-3 text-sm text-steel-2">
          Day {insights.busiestDay.dayIndex} is the heaviest, with{' '}
          {formatDuration(insights.busiestDay.activeMinutes + insights.busiestDay.travelMinutes)}{' '}
          accounted for. Day {insights.lightestDay.dayIndex} is the easiest.
          {insights.walkingMeters > 3000 && (
            <>
              {' '}
              About {metersToSteps(insights.walkingMeters).toLocaleString()} steps across the trip.
            </>
          )}
        </p>
      )}
    </section>
  );
}
