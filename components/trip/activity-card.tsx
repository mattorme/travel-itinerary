import { ExternalLink, MapPin, Star } from 'lucide-react';
import type { Activity } from '@/domain/types/itinerary';
import { formatMinute } from '@/domain/sequencing/schedule';
import { formatCurrency, formatDuration } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { PlacePhoto } from './place-photo';
import { TravelLegRow } from './travel-leg';

/**
 * One stop on a route.
 *
 * Laid out as a line diagram: a coloured rail down the left, a station marker
 * for the stop, and the time set in mono in its own column so times align down
 * the day the way a timetable does.
 *
 * Renders entirely from authored content — `title`, `description`, `reason` —
 * so a lapsed place cache degrades the card rather than emptying it. The Google
 * fields are decoration that appears when live, and carry the attribution the
 * Maps terms require.
 */
export function ActivityCard({
  activity,
  currency,
  isLast,
  routeColour,
  stopNumber,
  editor,
}: {
  activity: Activity;
  currency: string;
  isLast: boolean;
  routeColour: string;
  stopNumber: number;
  editor?: React.ReactNode;
}) {
  const hydrated = activity.place?.hydrated ?? null;
  const isMeal = activity.kind === 'meal';
  const hasPhoto = (hydrated?.photoNames.length ?? 0) > 0 && activity.place !== null;

  return (
    <li className="relative">
      {activity.inboundTravel && (
        <TravelLegRow leg={activity.inboundTravel} routeColour={routeColour} />
      )}

      <article className="relative grid grid-cols-[auto_1fr] gap-x-4 sm:grid-cols-[4rem_auto_1fr] sm:gap-x-5">
        {/* The rail and its station marker. */}
        <div
          className="col-start-1 row-start-1 flex flex-col items-center sm:col-start-2"
          aria-hidden
        >
          <span
            className={cn(
              'type-data grid shrink-0 place-items-center rounded-full text-[0.6875rem] font-medium',
              'size-[var(--stop-size)]',
              isMeal ? 'text-white' : 'border-[3px] bg-surface',
            )}
            style={
              isMeal
                ? { backgroundColor: routeColour }
                : { borderColor: routeColour, color: routeColour }
            }
          >
            {stopNumber}
          </span>
          {!isLast && (
            <span
              className="mt-1 w-[var(--rail-width)] flex-1"
              style={{ backgroundColor: routeColour, opacity: 0.4 }}
            />
          )}
        </div>

        <div
          id={`activity-${activity.id}`}
          className={cn(
            'col-start-2 row-start-1 min-w-0 scroll-mt-28 pb-9 sm:col-start-3',
            // Set by the map when a marker is clicked, so the two views stay in
            // agreement about what you are looking at.
            'data-[map-focus=true]:outline data-[map-focus=true]:outline-2 data-[map-focus=true]:outline-offset-4 data-[map-focus=true]:outline-signal',
          )}
        >
          <p className="type-data flex flex-wrap items-baseline gap-x-3 text-[0.8125rem] text-steel">
            {/*
              One time element, placed by the grid rather than duplicated per
              breakpoint: on a wide viewport it moves into its own left-hand
              column so times line up down the day like a timetable, and on a
              phone it sits above the title. Rendering it twice made screen
              readers announce it twice.
            */}
            {activity.startMinute !== null && (
              <time
                className="sm:absolute sm:left-0 sm:w-16 sm:text-steel"
                dateTime={String(activity.startMinute)}
              >
                {formatMinute(activity.startMinute)}
              </time>
            )}
            {activity.durationMinutes !== null && (
              <span className="text-steel-2">{formatDuration(activity.durationMinutes)}</span>
            )}
            {activity.estimatedCost !== null && activity.estimatedCost > 0 && (
              <span className="text-steel-2">
                {formatCurrency(activity.estimatedCost, currency)}
              </span>
            )}
          </p>

          <h3 className="type-display mt-1 text-[1.375rem] leading-[1.08]">{activity.title}</h3>

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

          {/* Google Place Photos are billed per fetch, so they appear here — on
              the card, where they add something — and never behind a hero. */}
          {hasPhoto && (
            <PlacePhoto placeId={activity.place!.placeId} alt={activity.title} className="mt-4" />
          )}

          {editor}
        </div>
      </article>
    </li>
  );
}
