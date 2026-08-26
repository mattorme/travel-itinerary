import Link from 'next/link';
import { CalendarDays, Clock, Wallet } from 'lucide-react';
import type { Itinerary } from '@/domain/types/itinerary';
import { Cover } from '@/components/ui/cover';
import { formatCurrency, formatDateRange, humanise } from '@/lib/utils/format';
import { DayArc, ArcLegend } from './day-arc';

/**
 * The head of the trip page.
 *
 * Photograph first, because someone arriving from a link in a group chat is
 * deciding whether this looks like a trip they want. Then the facts as chips,
 * then the thing nothing else has: every day drawn across its real hours, so
 * the shape of the trip is readable before a word of it is.
 */
export function TripHero({ itinerary }: { itinerary: Itinerary }) {
  const route = itinerary.destinations.map((d) => d.name);
  const dates = formatDateRange(itinerary.request.dates.start, itinerary.request.dates.end);
  const cost = itinerary.estimatedCost?.total ?? null;
  const days = itinerary.request.dates.durationDays;

  const chips = [
    { icon: Clock, label: `${days} ${days === 1 ? 'day' : 'days'}` },
    ...(dates ? [{ icon: CalendarDays, label: dates }] : []),
    ...(cost !== null
      ? [{ icon: Wallet, label: `${formatCurrency(cost, itinerary.request.currency)} excl. flights` }]
      : []),
  ];

  const scheduled = itinerary.days.filter((day) =>
    day.activities.some((a) => a.startMinute !== null),
  );

  return (
    <header>
      {/* Always rendered: generated art when there is no photograph, because a
          missing hero makes the page that has to make the first impression
          look broken. */}
      <div className="relative -mx-4 aspect-[16/9] overflow-hidden bg-sunk sm:mx-0 sm:aspect-[21/9] sm:rounded-sheet sm:shadow-(--shadow-card)">
        <Cover
          imageUrl={itinerary.heroImageUrl}
          credit={itinerary.heroCredit}
          seed={itinerary.slug}
          label={route[0] ?? itinerary.title}
          priority
          sizes="(max-width: 640px) 100vw, 768px"
        />
      </div>

      {route.length > 0 && (
        <p className="type-label mt-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-signal">
          {route.map((name, i) => (
            <span key={name} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-rule-2" aria-hidden>
                  →
                </span>
              )}
              {name}
            </span>
          ))}
        </p>
      )}

      <h1 className="type-display type-title mt-3">{itinerary.title}</h1>

      {itinerary.subtitle && (
        <p className="mt-4 max-w-[52ch] text-[1.125rem] leading-[1.55] text-steel text-balance">
          {itinerary.subtitle}
        </p>
      )}

      <ul className="mt-6 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li
            key={chip.label}
            className="type-data flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[0.8125rem] text-steel shadow-(--shadow-card)"
          >
            <chip.icon className="size-3.5 shrink-0 text-signal" aria-hidden />
            {chip.label}
          </li>
        ))}
        <li className="type-data flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[0.8125rem] text-steel shadow-(--shadow-card)">
          {humanise(itinerary.request.pace)} pace · {humanise(itinerary.request.travelStyle)}
        </li>
      </ul>

      {/* The signature: the whole trip, hour by hour. */}
      {scheduled.length > 0 && (
        <section className="mt-8 rounded-panel bg-surface p-5 shadow-(--shadow-card) sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <h2 className="type-label text-ink">How the days run</h2>
            <ArcLegend />
          </div>

          <ol className="mt-5 space-y-2.5">
            {scheduled.map((day) => (
              <li key={day.id} className="flex items-center gap-3">
                <a
                  href={`#day-${day.dayIndex}`}
                  className="type-data w-11 shrink-0 text-[0.75rem] text-steel-2 transition-colors hover:text-signal"
                >
                  Day {day.dayIndex}
                </a>
                <DayArc
                  activities={day.activities}
                  label={`Day ${day.dayIndex}, ${day.title}`}
                  animate
                  className="flex-1"
                />
              </li>
            ))}
          </ol>

          {/* 2.75rem label column + 0.75rem gap: the scale starts where the arcs do. */}
          <p className="type-label mt-3 flex justify-between pl-14 text-steel-2">
            <span>6 am</span>
            <span>Midnight</span>
          </p>
        </section>
      )}

      {itinerary.summary && (
        <p className="mt-8 max-w-[62ch] text-[1.0625rem] leading-relaxed">{itinerary.summary}</p>
      )}

      {itinerary.highlights.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {itinerary.highlights.map((highlight) => (
            <li
              key={highlight}
              className="rounded-full bg-signal-wash px-3.5 py-1.5 text-[0.8125rem] font-medium text-signal-deep"
            >
              {highlight}
            </li>
          ))}
        </ul>
      )}

      {/* Attribution survives the source being deleted or made private — it
          just stops linking. Credit is never a 404. */}
      {itinerary.lineage.originCreatorUsername && (
        <p className="mt-6 text-[0.875rem] text-steel-2">
          Based on a trip by{' '}
          {itinerary.lineage.forkedFromTripId ? (
            <Link
              href={`/u/${itinerary.lineage.originCreatorUsername}`}
              className="font-semibold text-signal hover:underline"
            >
              @{itinerary.lineage.originCreatorUsername}
            </Link>
          ) : (
            <span>@{itinerary.lineage.originCreatorUsername}</span>
          )}
        </p>
      )}
    </header>
  );
}
