import { ExternalLink, MapPin, Star } from 'lucide-react';
import type { Activity } from '@/domain/types/itinerary';
import { formatMinute } from '@/domain/sequencing/schedule';
import { bandOf } from '@/domain/schedule/time-of-day';
import { formatCurrency, formatDuration } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { BAND_DOT } from './day-arc';
import { PlacePhoto } from './place-photo';
import { TravelLegRow } from './travel-leg';

/**
 * One stop.
 *
 * The time leads, because time is what the whole product is organised by, and
 * it carries the colour of its hour — the same three colours the arc above is
 * drawn in, so a 7pm stop looks like the rose segment it came from. The dot is
 * redundant with the time beside it by design: colour never carries meaning on
 * its own here.
 *
 * Renders entirely from authored content — `title`, `description`, `reason` —
 * so a lapsed place cache degrades the card rather than emptying it. The Google
 * fields are extras that appear when live, and carry the attribution the Maps
 * terms require.
 */

export function ActivityCard({
  activity,
  currency,
  editor,
}: {
  activity: Activity;
  currency: string;
  editor?: React.ReactNode;
}) {
  const hydrated = activity.place?.hydrated ?? null;
  const hasPhoto = (hydrated?.photoNames.length ?? 0) > 0 && activity.place !== null;
  const band = activity.startMinute !== null ? bandOf(activity.startMinute) : null;

  return (
    <li>
      {activity.inboundTravel && <TravelLegRow leg={activity.inboundTravel} />}

      <article
        id={`activity-${activity.id}`}
        className={cn(
          'overflow-hidden rounded-panel bg-surface shadow-(--shadow-card) scroll-mt-28',
          'transition-shadow duration-200 hover:shadow-(--shadow-lift)',
          // Set by the map when a marker is clicked, so the two views stay in
          // agreement about what you are looking at.
          'data-[map-focus=true]:outline data-[map-focus=true]:outline-2 data-[map-focus=true]:outline-offset-3 data-[map-focus=true]:outline-signal',
        )}
      >
        {/* Google Place Photos are billed per fetch, so they appear here — on
            the card, where they add something — and never behind a hero. */}
        {hasPhoto && (
          <PlacePhoto
            placeId={activity.place!.placeId}
            alt={activity.title}
            className="rounded-none"
          />
        )}

        <div className="p-4 sm:p-5">
          <p className="type-data flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.8125rem] text-steel-2">
            {activity.startMinute !== null && band && (
              <span className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 self-center rounded-full', BAND_DOT[band])}
                />
                <time
                  className="text-[1.0625rem] font-semibold text-ink"
                  dateTime={String(activity.startMinute)}
                >
                  {formatMinute(activity.startMinute)}
                </time>
              </span>
            )}
            {activity.durationMinutes !== null && (
              <span>{formatDuration(activity.durationMinutes)}</span>
            )}
            {activity.estimatedCost !== null && activity.estimatedCost > 0 && (
              <span>{formatCurrency(activity.estimatedCost, currency)}</span>
            )}
          </p>

          <h3 className="type-display mt-1.5 text-[1.375rem]">{activity.title}</h3>

          {activity.reason && (
            <p className="mt-2 text-[0.9375rem] leading-relaxed">{activity.reason}</p>
          )}
          {activity.description && (
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-steel">
              {activity.description}
            </p>
          )}

          {hydrated && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-steel-2">
              {hydrated.rating !== null && (
                <span className="type-data flex items-center gap-1">
                  <Star className="size-3.5 fill-current" aria-hidden />
                  {hydrated.rating.toFixed(1)}
                  {hydrated.userRatingCount !== null && (
                    <span> ({hydrated.userRatingCount.toLocaleString()})</span>
                  )}
                </span>
              )}
              {hydrated.googleMapsUri && (
                <a
                  href={hydrated.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-ink"
                >
                  <MapPin className="size-3.5" aria-hidden />
                  Map
                </a>
              )}
              {activity.bookingUrl && (
                <a
                  href={activity.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-ink"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Website
                </a>
              )}
            </div>
          )}

          {editor}
        </div>
      </article>
    </li>
  );
}
