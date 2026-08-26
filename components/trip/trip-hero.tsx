import Link from 'next/link';
import type { Itinerary } from '@/domain/types/itinerary';
import { Cover } from '@/components/ui/cover';
import { formatCurrency, formatDateRange, humanise } from '@/lib/utils/format';
import { DayArc, ArcLegend } from './day-arc';

/**
 * The head of the trip page.
 *
 * The hero is the trip's shape: every day drawn across its real hours, stacked,
 * so a stranger arriving from a link in a group chat can see before reading a
 * word whether this is a trip of early starts or one that lives at night. The
 * photograph is atmosphere behind it, not the subject — the schedule is the
 * subject, and the schedule is the thing no other itinerary has.
 */
export function TripHero({ itinerary }: { itinerary: Itinerary }) {
  const route = itinerary.destinations.map((d) => d.name);
  const dates = formatDateRange(itinerary.request.dates.start, itinerary.request.dates.end);
  const cost = itinerary.estimatedCost?.total ?? null;
  const days = itinerary.request.dates.durationDays;

  const facts = [
    `${days} ${days === 1 ? 'day' : 'days'}`,
    ...(dates ? [dates] : []),
    ...(cost !== null ? [`${formatCurrency(cost, itinerary.request.currency)} excl. flights`] : []),
    `${humanise(itinerary.request.pace)} pace`,
    humanise(itinerary.request.travelStyle),
  ];

  const scheduled = itinerary.days.filter((day) =>
    day.activities.some((a) => a.startMinute !== null),
  );

  return (
    <header>
      <div className="relative -mx-4 overflow-hidden bg-ink text-white sm:mx-0 sm:rounded-panel">
        {/* Atmosphere. Always rendered: generated art when there is no
            photograph, because a missing hero makes the page that has to make
            the first impression look broken. */}
        <Cover
          imageUrl={itinerary.heroImageUrl}
          credit={itinerary.heroCredit}
          seed={itinerary.slug}
          label={route[0] ?? itinerary.title}
          priority
          sizes="(max-width: 640px) 100vw, 768px"
        />
        {/*
          Opaque where the type sits, clear at the top where the photograph
          gets to be a photograph. Anchored to ink at the bottom so white text
          holds 7:1 no matter how bright the image behind it turns out to be.
        */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink from-45% via-ink/90 to-ink/55"
        />

        <div className="relative px-5 pt-36 pb-7 sm:px-8 sm:pt-44 sm:pb-9">
          {route.length > 0 && (
            <p className="type-label flex flex-wrap items-center gap-x-2 gap-y-1 text-white/65">
              {route.map((name, i) => (
                <span key={name} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-white/35" aria-hidden>
                      →
                    </span>
                  )}
                  {name}
                </span>
              ))}
            </p>
          )}

          <h1 className="type-display type-hero mt-3">{itinerary.title}</h1>

          {itinerary.subtitle && (
            <p className="mt-4 max-w-[48ch] text-[1.125rem] leading-[1.45] text-white/80 text-balance">
              {itinerary.subtitle}
            </p>
          )}

          {/* The facts, as one read-through line rather than five boxes. */}
          <p className="type-data mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.875rem] text-white/75">
            {facts.map((fact, i) => (
              <span key={fact} className="flex items-center gap-2.5">
                {i > 0 && (
                  <span className="text-white/30" aria-hidden>
                    ·
                  </span>
                )}
                {fact}
              </span>
            ))}
          </p>

          {/* The signature: the whole trip, hour by hour. */}
          {scheduled.length > 0 && (
            <section className="mt-8 border-t border-white/15 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <h2 className="type-label text-white/65">How the days run</h2>
                <ArcLegend tone="ink" />
              </div>

              <ol className="mt-4 space-y-2">
                {scheduled.map((day) => (
                  <li key={day.id} className="flex items-center gap-3">
                    <a
                      href={`#day-${day.dayIndex}`}
                      className="type-data w-11 shrink-0 text-[0.75rem] text-white/60 transition-colors hover:text-white"
                    >
                      Day {day.dayIndex}
                    </a>
                    <DayArc
                      activities={day.activities}
                      label={`Day ${day.dayIndex}, ${day.title}`}
                      tone="ink"
                      animate
                      className="flex-1"
                    />
                  </li>
                ))}
              </ol>

              <p className="type-label mt-3 flex justify-between pl-14 text-white/40">
                <span>6 am</span>
                <span>Midnight</span>
              </p>
            </section>
          )}
        </div>
      </div>

      {itinerary.summary && (
        <p className="mt-8 max-w-[62ch] text-[1.0625rem] leading-relaxed">{itinerary.summary}</p>
      )}

      {itinerary.highlights.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {itinerary.highlights.map((highlight) => (
            <li
              key={highlight}
              className="rounded-full border border-rule-2 bg-surface px-3.5 py-1.5 text-[0.8125rem] text-steel"
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
              className="font-medium text-ink underline decoration-rule-2 underline-offset-4 hover:decoration-ink"
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
