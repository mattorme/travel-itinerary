import {
  ARC_SPAN,
  ARC_START,
  arcSegments,
  describeArc,
  TIME_BANDS,
  type TimeBand,
} from '@/domain/schedule/time-of-day';
import { cn } from '@/lib/utils/cn';
import { stagger } from '@/lib/utils/motion';

/**
 * The day arc — the one thing this product is remembered by.
 *
 * A day drawn across its real hours: 06:00 on the left, midnight on the right,
 * with every stop placed at the time it actually starts and sized by how long
 * it actually runs. Amber morning, cyan afternoon, pink evening.
 *
 * It answers, before you read a word, the question people really have about
 * someone else's itinerary: is this a trip of early starts, or one that lives
 * at night? A gap in the middle is a free afternoon. A dense left edge is a
 * trip that gets up. None of that is decoration — it is the schedule.
 *
 * Rendered from the same data the timeline below it renders, so the two can
 * never disagree, and described in words for anyone not seeing the shape.
 */

/**
 * The hour colours as classes, exported because the arc's vocabulary has to be
 * the same wherever an hour is marked — the dot beside a time on a stop card is
 * the same colour as that stop's segment up here, and a second copy of this map
 * is how that quietly stops being true.
 */
export const BAND_DOT: Record<TimeBand, string> = {
  morning: 'bg-morning',
  afternoon: 'bg-afternoon',
  evening: 'bg-evening',
};

/**
 * Noon and 5pm, as fractions of the window.
 *
 * Drawn faintly into the track so an empty stretch reads as a free afternoon
 * rather than as nothing — a gap only means something once you can see which
 * hours it covers.
 */
const BAND_EDGES = [12 * 60, 17 * 60].map((minute) => (minute - ARC_START) / ARC_SPAN);

export function DayArc({
  activities,
  label,
  animate = false,
  className,
}: {
  activities: readonly { startMinute: number | null; durationMinutes: number | null }[];
  /** Names the day for anyone reading the description instead of the shape. */
  label: string;
  animate?: boolean;
  className?: string;
}) {
  const segments = arcSegments(activities);

  return (
    <div
      role="img"
      aria-label={describeArc(label, segments)}
      className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-sunk', className)}
    >
      {BAND_EDGES.map((edge) => (
        <span
          key={edge}
          aria-hidden
          className="absolute inset-y-0 w-px bg-rule-2"
          style={{ left: `${edge * 100}%` }}
        />
      ))}

      {segments.map((segment, index) => (
        <span
          key={index}
          className={cn(
            'absolute inset-y-0 rounded-full shadow-[0_1px_2px_rgb(15_20_36/0.12)]',
            BAND_DOT[segment.band],
            animate && 'arc-draw',
          )}
          style={{
            left: `${segment.offset * 100}%`,
            width: `${segment.width * 100}%`,
            ...(animate ? stagger(index) : {}),
          }}
        />
      ))}
    </div>
  );
}

/**
 * What the colours mean. Shown once per page, next to the first arc — the arc
 * has to be self-explanatory the first time someone sees it, and never again
 * after that.
 */
export function ArcLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-steel-2">
      {TIME_BANDS.map((band) => (
        <li key={band} className="type-label flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', BAND_DOT[band])} />
          {band}
        </li>
      ))}
    </ul>
  );
}
