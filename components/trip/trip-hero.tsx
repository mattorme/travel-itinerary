import Link from 'next/link';
import type { Itinerary } from '@/domain/types/itinerary';
import { Cover } from '@/components/ui/cover';
import { formatCurrency, formatDateRange, humanise } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * The head of the trip page.
 *
 * Built like a service board: the route as a chain of names, the headline at
 * signage scale, then the facts in a hard-ruled strip. Someone arriving cold
 * from a link in a group chat should have where, how long and how much before
 * they scroll.
 */
export function TripHero({ itinerary }: { itinerary: Itinerary }) {
  const route = itinerary.destinations.map((d) => d.name);
  const dates = formatDateRange(itinerary.request.dates.start, itinerary.request.dates.end);
  const cost = itinerary.estimatedCost?.total ?? null;
  const days = itinerary.request.dates.durationDays;

  // `numeric` decides the typeface: mono is for figures a reader might compare
  // down a column. Setting a word like "relaxed" in mono just looks like code.
  const facts: { label: string; value: string; sub?: string; numeric?: boolean }[] = [
    { label: 'Duration', value: `${days} ${days === 1 ? 'day' : 'days'}`, numeric: true },
    ...(cost !== null
      ? [{
          label: 'Estimated',
          value: formatCurrency(cost, itinerary.request.currency),
          sub: 'excl. flights',
          numeric: true,
        }]
      : []),
    ...(dates ? [{ label: 'Dates', value: dates, numeric: true }] : []),
    { label: 'Pace', value: humanise(itinerary.request.pace) },
    { label: 'Style', value: humanise(itinerary.request.travelStyle) },
  ];

  return (
    <header>
      {/* Always rendered: generated art when there is no photograph, because a
          missing hero makes the page that has to make the first impression
          look broken. */}
      <div className="relative -mx-4 aspect-[16/10] overflow-hidden bg-sunk sm:mx-0 sm:aspect-[24/9]">
        <Cover
          imageUrl={itinerary.heroImageUrl}
          credit={itinerary.heroCredit}
          seed={itinerary.slug}
          label={route[0] ?? itinerary.title}
          priority
          sizes="(max-width: 640px) 100vw, 768px"
        />
      </div>

      {/* The route, as a chain of station names. */}
      {route.length > 0 && (
        <p className="type-label mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-steel">
          {route.map((name, i) => (
            <span key={name} className="flex items-center gap-2">
              {i > 0 && <span className="text-rule-2" aria-hidden>→</span>}
              {name}
            </span>
          ))}
        </p>
      )}

      <h1 className="type-display type-hero mt-3">{itinerary.title}</h1>

      {itinerary.subtitle && (
        <p className="mt-4 max-w-[54ch] text-[1.25rem] leading-[1.35] text-steel text-balance">
          {itinerary.subtitle}
        </p>
      )}

      {/*
        Hard-ruled fact strip — a timetable header, not a card grid.

        Hairlines come from a 1px grid gap over a ruled background rather than
        per-cell borders: cells wrap from five columns to two on a phone, and
        nth-child borders get the edges wrong on every layout but the one they
        were written for.
      */}
      <dl className="mt-8 grid grid-cols-2 gap-px border-y-2 border-ink bg-rule sm:grid-cols-3 lg:grid-cols-5">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-paper px-3 py-3.5">
            <dt className="type-label text-steel-2">{fact.label}</dt>
            <dd
              className={cn(
                'mt-1 text-[1.0625rem] leading-tight',
                fact.numeric ? 'type-data' : 'font-medium',
              )}
            >
              {fact.value}
              {fact.sub && (
                <span className="mt-0.5 block text-[0.75rem] font-normal text-steel-2">
                  {fact.sub}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {itinerary.summary && (
        <p className="mt-8 max-w-[62ch] text-[1.0625rem] leading-relaxed">{itinerary.summary}</p>
      )}

      {itinerary.highlights.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {itinerary.highlights.map((highlight) => (
            <li
              key={highlight}
              className="rounded-edge border border-rule-2 px-3 py-1.5 text-[0.8125rem] text-steel"
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
              className="text-signal underline underline-offset-4"
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
