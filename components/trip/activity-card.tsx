import { ExternalLink, MapPin, Star } from 'lucide-react';
import type { Activity } from '@/domain/types/itinerary';
import { formatMinute } from '@/domain/sequencing/schedule';
import { formatCurrency, formatDuration } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TravelLegRow } from './travel-leg';

/**
 * One stop on a day.
 *
 * Renders entirely from authored content (`title`, `description`, `reason`) so
 * that a lapsed place cache degrades the card rather than emptying it. Google
 * fields — rating, address, maps link — are decoration that appears when live,
 * and carry the attribution the Maps terms require.
 */
export function ActivityCard({
  activity,
  currency,
  isLast,
  editor,
}: {
  activity: Activity;
  currency: string;
  isLast: boolean;
  /** Owner-only controls. Absent on the public page. */
  editor?: React.ReactNode;
}) {
  const hydrated = activity.place?.hydrated ?? null;
  const isMeal = activity.kind === 'meal';

  return (
    <li className="relative">
      {activity.inboundTravel && <TravelLegRow leg={activity.inboundTravel} />}

      <article className="relative flex gap-4">
        {/* Timeline rail */}
        <div className="flex flex-col items-center" aria-hidden>
          <span
            className={cn(
              'mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-paper',
              isMeal ? 'bg-accent' : 'bg-ink',
            )}
          />
          {!isLast && <span className="mt-1 w-px flex-1 bg-line" />}
        </div>

        <div className="min-w-0 flex-1 pb-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {activity.startMinute !== null && (
              <time className="text-sm font-medium tabular-nums text-ink-muted">
                {formatMinute(activity.startMinute)}
              </time>
            )}
            {activity.durationMinutes !== null && (
              <span className="text-sm text-ink-faint">
                {formatDuration(activity.durationMinutes)}
              </span>
            )}
            {activity.estimatedCost !== null && activity.estimatedCost > 0 && (
              <span className="text-sm text-ink-faint">
                ~{formatCurrency(activity.estimatedCost, currency)}
              </span>
            )}
          </div>

          <h3 className="mt-1 font-display text-xl leading-snug text-balance">
            {activity.title}
          </h3>

          {activity.reason && (
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">{activity.reason}</p>
          )}

          {activity.description && (
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
              {activity.description}
            </p>
          )}

          {hydrated && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-faint">
              {hydrated.rating !== null && (
                <span className="flex items-center gap-1">
                  <Star className="size-3.5 fill-current" aria-hidden />
                  {hydrated.rating.toFixed(1)}
                  {hydrated.userRatingCount !== null && (
                    <span className="text-ink-faint"> ({hydrated.userRatingCount.toLocaleString()})</span>
                  )}
                </span>
              )}
              {hydrated.googleMapsUri && (
                <a
                  href={hydrated.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 underline underline-offset-4 hover:text-ink"
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
                  className="flex items-center gap-1 underline underline-offset-4 hover:text-ink"
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
