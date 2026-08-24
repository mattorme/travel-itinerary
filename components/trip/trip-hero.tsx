import Image from 'next/image';
import Link from 'next/link';
import type { Itinerary } from '@/domain/types/itinerary';
import { formatCurrency, formatDateRange, humanise } from '@/lib/utils/format';

/**
 * The editorial header.
 *
 * This is the first thing someone sees after tapping a shared link, so it has
 * to answer "where, how long, how much, who made it" before any scrolling —
 * and look like a magazine rather than a dashboard.
 */
export function TripHero({ itinerary }: { itinerary: Itinerary }) {
  const route = itinerary.destinations.map((d) => d.name);
  const dates = formatDateRange(itinerary.request.dates.start, itinerary.request.dates.end);
  const cost = itinerary.estimatedCost?.total ?? null;

  return (
    <header className="relative">
      {itinerary.heroImageUrl && (
        <div className="relative -mx-5 mb-8 aspect-[3/2] overflow-hidden sm:mx-0 sm:aspect-[21/9] sm:rounded-card">
          <Image
            src={itinerary.heroImageUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
        {itinerary.request.dates.durationDays}{' '}
        {itinerary.request.dates.durationDays === 1 ? 'day' : 'days'}
        {route.length > 0 && ` · ${route.join(' → ')}`}
      </p>

      <h1 className="font-display text-display mt-3 text-balance">{itinerary.title}</h1>

      {itinerary.subtitle && (
        <p className="mt-4 max-w-2xl text-xl leading-snug text-ink-muted text-balance">
          {itinerary.subtitle}
        </p>
      )}

      <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-5 text-sm">
        {cost !== null && (
          <div>
            <dt className="text-ink-faint">Estimated</dt>
            <dd className="mt-0.5 text-base">
              ~{formatCurrency(cost, itinerary.request.currency)}
              <span className="text-ink-faint"> excl. flights</span>
            </dd>
          </div>
        )}
        {dates && (
          <div>
            <dt className="text-ink-faint">Dates</dt>
            <dd className="mt-0.5 text-base">{dates}</dd>
          </div>
        )}
        <div>
          <dt className="text-ink-faint">Pace</dt>
          <dd className="mt-0.5 text-base capitalize">{humanise(itinerary.request.pace)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Style</dt>
          <dd className="mt-0.5 text-base capitalize">{humanise(itinerary.request.travelStyle)}</dd>
        </div>
      </dl>

      {itinerary.summary && (
        <p className="mt-8 max-w-2xl text-[1.0625rem] leading-relaxed">{itinerary.summary}</p>
      )}

      {itinerary.highlights.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {itinerary.highlights.map((highlight) => (
            <li
              key={highlight}
              className="rounded-full bg-paper-sunk px-3.5 py-1.5 text-sm text-ink-muted"
            >
              {highlight}
            </li>
          ))}
        </ul>
      )}

      {/* Attribution survives the source being deleted or made private — it just
          stops linking. Credit is never a 404. */}
      {itinerary.lineage.originCreatorUsername && (
        <p className="mt-6 text-sm text-ink-faint">
          Based on a trip by{' '}
          {itinerary.lineage.forkedFromTripId ? (
            <Link
              href={`/u/${itinerary.lineage.originCreatorUsername}`}
              className="underline underline-offset-4 hover:text-ink"
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
