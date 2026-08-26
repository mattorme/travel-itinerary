import {
  ARC_SPAN,
  ARC_START,
  arcSegments,
  describeArc,
  TIME_BANDS,
  type TimeBand,
} from '@/domain/schedule/time-of-day';
import { cn } from '@/lib/utils/cn';

/**
 * The day arc — the one thing this product is remembered by.
 *
 * A day drawn across its real hours: 06:00 on the left, midnight on the right,
 * with every stop placed at the time it actually starts and sized by how long
 * it actually runs. Amber morning, teal afternoon, rose evening.
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
 * Noon and 5pm, as fractions of the window.
 *
 * Drawn faintly into the track so an empty stretch reads as a free afternoon
 * rather than as nothing — a gap only means something once you can see which
 * hours it covers.
 */
const BAND_EDGES = [12 * 60, 17 * 60].map((minute) => (minute - ARC_START) / ARC_SPAN);

const BAND_FILL: Record<TimeBand, { onInk: string; onPaper: string }> = {
  morning: { onInk: 'bg-morning', onPaper: 'bg-morning-ink' },
  afternoon: { onInk: 'bg-afternoon', onPaper: 'bg-afternoon-ink' },
  evening: { onInk: 'bg-evening', onPaper: 'bg-evening-ink' },
};

export function DayArc({
  activities,
  label,
  tone = 'paper',
  animate = false,
  className,
}: {
  activities: readonly { startMinute: number | null; durationMinutes: number | null }[];
  /** Names the day for anyone reading the description instead of the shape. */
  label: string;
  /** Which ground it sits on — decides which tuning of the hour colours is used. */
  tone?: 'ink' | 'paper';
  animate?: boolean;
  className?: string;
}) {
  const segments = arcSegments(activities);
  const onInk = tone === 'ink';

  return (
    <div
      role="img"
      aria-label={describeArc(label, segments)}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full',
        onInk ? 'bg-white/12' : 'bg-sunk',
        className,
      )}
    >
      {BAND_EDGES.map((edge) => (
        <span
          key={edge}
          aria-hidden
          className={onInk ? 'absolute inset-y-0 w-px bg-white/20' : 'absolute inset-y-0 w-px bg-rule-2'}
          style={{ left: `${edge * 100}%` }}
        />
      ))}

      {segments.map((segment, index) => (
        <span
          key={index}
          className={cn(
            'absolute inset-y-0 rounded-full',
            onInk ? BAND_FILL[segment.band].onInk : BAND_FILL[segment.band].onPaper,
            animate && 'arc-draw',
          )}
          style={{
            left: `${segment.offset * 100}%`,
            width: `${segment.width * 100}%`,
            ...(animate ? ({ '--i': index } as React.CSSProperties) : {}),
          }}
        />
      ))}
    </div>
  );
}

/**
 * What the colours mean. Shown once per page, next to the first arc — the
 * arc has to be self-explanatory the first time someone sees it, and never
 * again after that.
 */
export function ArcLegend({ tone = 'paper' }: { tone?: 'ink' | 'paper' }) {
  const onInk = tone === 'ink';
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1', onInk ? 'text-white/70' : 'text-steel-2')}>
      {TIME_BANDS.map((band) => (
        <li key={band} className="type-label flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'size-2 shrink-0 rounded-full',
              onInk ? BAND_FILL[band].onInk : BAND_FILL[band].onPaper,
            )}
          />
          {band}
        </li>
      ))}
    </ul>
  );
}
