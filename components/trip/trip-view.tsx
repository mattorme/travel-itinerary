import type { Itinerary } from '@/domain/types/itinerary';
import { formatMinute } from '@/domain/sequencing/schedule';
import { TripHero } from './trip-hero';
import { DayNav } from './day-nav';
import { DaySection } from './day-section';
import { BudgetPanel } from './budget-panel';
import { TripMap } from './map/trip-map';
import { TripInsights } from './trip-insights';
import { ActivityEditor } from './activity-editor';
import { AddStop } from './add-stop';

/**
 * The itinerary itself, shared by the public page and the owner's view.
 *
 * Single column on purpose: this reads top to bottom like an article, and on a
 * phone — which is where it is mostly read — a sidebar would just be a second
 * scroll region competing with the first.
 */
export function TripView({
  itinerary,
  actions,
  footer,
  editable = false,
}: {
  itinerary: Itinerary;
  actions?: React.ReactNode;
  /** Rendered after the budget panel. Comments on the public page. */
  footer?: React.ReactNode;
  /** Owner's view. Adds per-activity controls; never set on the public page. */
  editable?: boolean;
}) {
  const stops = itinerary.days.flatMap((day) =>
    day.activities.flatMap((activity, index) => {
      const location = activity.place?.hydrated?.location;
      if (!location) return [];
      return [
        {
          activityId: activity.id,
          dayIndex: day.dayIndex,
          stopNumber: index + 1,
          title: activity.title,
          kind: activity.kind,
          lat: location.lat,
          lng: location.lng,
          startLabel: activity.startMinute !== null ? formatMinute(activity.startMinute) : null,
        },
      ];
    }),
  );

  return (
    <article className="mx-auto max-w-2xl px-5 pb-24">
      <TripHero itinerary={itinerary} />

      {actions && <div className="mt-8">{actions}</div>}

      <TripInsights itinerary={itinerary} />

      {stops.length > 0 && (
        <div className="mt-10">
          <TripMap stops={stops} dayCount={itinerary.days.length} title={itinerary.title} />
        </div>
      )}

      <DayNav days={itinerary.days.map((d) => ({ dayIndex: d.dayIndex, title: d.title }))} />

      <div className="mt-10 space-y-12">
        {itinerary.days.map((day) => (
          <DaySection
            key={day.id}
            day={day}
            currency={itinerary.request.currency}
            {...(editable
              ? {
                  dayFooter: <AddStop tripId={itinerary.id} dayId={day.id} />,
                  renderEditor: (activityId, index, count, isLocked, canSwap) => (
                    <ActivityEditor
                      tripId={itinerary.id}
                      activityId={activityId}
                      index={index}
                      count={count}
                      isLocked={isLocked}
                      canSwap={canSwap}
                    />
                  ),
                }
              : {})}
          />
        ))}
      </div>

      {itinerary.estimatedCost && (
        <div className="mt-12">
          <BudgetPanel
            breakdown={itinerary.estimatedCost}
            currency={itinerary.request.currency}
            budgetTotal={itinerary.request.budgetTotal}
          />
        </div>
      )}

      {footer}

      {/* Required when Places content is shown without a Google map. Rendered
          here so it cannot be forgotten on a page that shows place data. */}
      <p className="mt-8 text-xs text-ink-faint">
        Place information and photos from Google Maps.
      </p>
    </article>
  );
}
