import type { TripDay } from '@/domain/types/itinerary';
import { formatCurrency } from '@/lib/utils/format';
import { dayColour } from './map/types';
import { ActivityCard } from './activity-card';

/**
 * One day, as one line on the diagram.
 *
 * The day's route colour is the same value the map uses for its markers and
 * polyline, so a day is recognisable at a glance in either view. That shared
 * palette is the product's identity, which is why it lives in one module rather
 * than being restated here.
 */
export function DaySection({
  day,
  currency,
  dayFooter,
  renderEditor,
}: {
  day: TripDay;
  currency: string;
  /** Owner-only controls rendered under the day's stops. */
  dayFooter?: React.ReactNode;
  /** Supplied only in the owner's view. */
  renderEditor?: (
    activityId: string,
    index: number,
    count: number,
    isLocked: boolean,
    canSwap: boolean,
  ) => React.ReactNode;
}) {
  const colour = dayColour(day.dayIndex);
  const date = day.date
    ? new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : null;

  return (
    <section id={`day-${day.dayIndex}`} className="scroll-mt-32">
      <header className="mb-8">
        {/* The line badge: how a route identifies itself on a diagram. */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="type-label inline-flex h-6 items-center px-2 text-white"
            style={{ backgroundColor: colour }}
          >
            Day {day.dayIndex}
          </span>
          {date && <span className="type-label text-steel-2">{date}</span>}
        </div>

        <h2 className="type-display type-title mt-3">{day.title}</h2>

        {day.summary && (
          <p className="mt-3 max-w-[62ch] text-[1.0625rem] leading-relaxed text-steel">
            {day.summary}
          </p>
        )}

        {/* Mono for the figure, sans for the sentence — a whole line set in
            mono reads as a code sample, not a price. */}
        {day.estimatedCost !== null && day.estimatedCost > 0 && (
          <p className="mt-3 text-[0.8125rem] text-steel-2">
            <span className="type-data">{formatCurrency(day.estimatedCost, currency)}</span> for the
            day, excl. where you stay
          </p>
        )}
      </header>

      {day.activities.length > 0 ? (
        <ol className="list-none">
          {day.activities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              currency={currency}
              routeColour={colour}
              stopNumber={index + 1}
              isLast={index === day.activities.length - 1}
              editor={renderEditor?.(
                activity.id,
                index,
                day.activities.length,
                activity.isLocked,
                activity.place !== null,
              )}
            />
          ))}
        </ol>
      ) : (
        <p className="text-steel-2">Nothing planned for this day yet.</p>
      )}

      {dayFooter}

      {/* Honest about what we couldn't fit, rather than silently dropping it. */}
      {day.notes && (
        <p className="mt-3 border-l-2 border-rule-2 bg-sunk px-4 py-3 text-[0.875rem] text-steel">
          {day.notes}
        </p>
      )}
    </section>
  );
}
