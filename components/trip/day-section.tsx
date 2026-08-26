import type { TripDay } from '@/domain/types/itinerary';
import { formatCurrency } from '@/lib/utils/format';
import { ActivityCard } from './activity-card';
import { DayArc } from './day-arc';

/**
 * One day.
 *
 * The heading carries the day's own arc, so the shape you picked out of the
 * stack in the hero is the same shape you land on when you scroll to it. Stops
 * below are cards in time order; the hours down the left are the thread that
 * holds them together, which is why no numbering is added — the order is
 * already in the times, and numbering it twice says nothing new.
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
  const date = day.date
    ? new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : null;
  const scheduled = day.activities.some((a) => a.startMinute !== null);

  return (
    <section id={`day-${day.dayIndex}`} className="scroll-mt-32">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-label text-signal">Day {day.dayIndex}</span>
          {date && <span className="type-label text-steel-2">{date}</span>}
        </div>

        <h2 className="type-display type-title mt-2">{day.title}</h2>

        {scheduled && (
          <DayArc
            activities={day.activities}
            label={`Day ${day.dayIndex}, ${day.title}`}
            className="mt-4"
          />
        )}

        {day.summary && (
          <p className="mt-4 max-w-[62ch] text-[1.0625rem] leading-relaxed text-steel">
            {day.summary}
          </p>
        )}

        {day.estimatedCost !== null && day.estimatedCost > 0 && (
          <p className="mt-3 text-[0.8125rem] text-steel-2">
            <span className="type-data">{formatCurrency(day.estimatedCost, currency)}</span> for the
            day, excl. where you stay
          </p>
        )}
      </header>

      {day.activities.length > 0 ? (
        <ol className="list-none space-y-3">
          {day.activities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              currency={currency}
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
        <p className="text-steel-2">Nothing planned for this day yet. Add the first stop below.</p>
      )}

      {dayFooter}

      {/* Honest about what we couldn't fit, rather than silently dropping it. */}
      {day.notes && (
        <p className="mt-4 rounded-edge border-l-3 border-caution bg-caution/8 px-4 py-3 text-[0.875rem] text-steel">
          {day.notes}
        </p>
      )}
    </section>
  );
}
