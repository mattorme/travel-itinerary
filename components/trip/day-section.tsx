import type { TripDay } from '@/domain/types/itinerary';
import { formatCurrency } from '@/lib/utils/format';
import { ActivityCard } from './activity-card';

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

  return (
    <section id={`day-${day.dayIndex}`} className="scroll-mt-24 border-t border-line pt-10">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
          Day {day.dayIndex}
          {date && <span className="normal-case tracking-normal"> · {date}</span>}
        </p>
        <h2 className="mt-2 font-display text-display-sm text-balance">{day.title}</h2>
        {day.summary && (
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-ink-muted">
            {day.summary}
          </p>
        )}
        {day.estimatedCost !== null && day.estimatedCost > 0 && (
          <p className="mt-3 text-sm text-ink-faint">
            ~{formatCurrency(day.estimatedCost, currency)} for the day, excluding where you stay
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
        <p className="text-ink-faint">Nothing planned for this day yet.</p>
      )}

      {dayFooter}

      {/* Honest about what we couldn't fit, rather than silently dropping it. */}
      {day.notes && (
        <p className="mt-2 rounded-xl border border-line bg-paper-sunk px-4 py-3 text-sm text-ink-muted">
          {day.notes}
        </p>
      )}
    </section>
  );
}
