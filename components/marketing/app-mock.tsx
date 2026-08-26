import { Sparkles } from 'lucide-react';
import { DayArc } from '@/components/trip/day-arc';
import { bandOf, type TimeBand } from '@/domain/schedule/time-of-day';
import { formatMinute } from '@/domain/sequencing/schedule';

/**
 * The hero device.
 *
 * A tilted, layered rendering of the actual product surface rather than a stock
 * illustration: the day arc, the stops, and the times, drawn by the same
 * components and the same functions the real trip page uses. If the arc ever
 * changes, this changes with it — a marketing mock that can drift out of date
 * is a promise the product stops keeping.
 *
 * Decorative as a whole: the landing copy beside it already states everything
 * this shows, so the composition is hidden from assistive technology rather
 * than narrated stop by stop.
 */

const STOPS = [
  { start: 570, minutes: 75, name: 'Yanaka Cemetery', note: 'Before anything opens' },
  { start: 660, minutes: 80, name: 'Yanaka Ginza', note: 'One sloping street of shops' },
  { start: 800, minutes: 60, name: 'Soba lunch in Nezu', note: 'Counter seating, cash only' },
  { start: 1140, minutes: 120, name: 'Izakaya on Kototoi-dori', note: 'Booked for four' },
] as const;

const BAND_DOT: Record<TimeBand, string> = {
  morning: 'bg-morning-ink',
  afternoon: 'bg-afternoon-ink',
  evening: 'bg-evening-ink',
};

export function AppMock() {
  const activities = STOPS.map((s) => ({ startMinute: s.start, durationMinutes: s.minutes }));

  return (
    <div aria-hidden className="relative">
      {/*
        The window. Tilted on wide screens only — on a phone it is just a card,
        because a perspective transform at 380px wide only costs legibility.

        The entrance animation lives on the wrapper, not on the tilted element:
        an animation with `fill-mode: both` holds its final keyframe, and that
        keyframe's `transform: none` would silently cancel the tilt.
      */}
      <div className="rise">
        <div className="overflow-hidden rounded-sheet bg-surface shadow-(--shadow-deep) lg:tilt">
          <div className="flex items-center gap-2 border-b border-rule bg-sunk/60 px-4 py-3">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 truncate rounded-full bg-surface px-3 py-1 text-[0.6875rem] text-steel-2">
              wayfare.app/t/three-slow-days-in-tokyo
            </span>
          </div>

          <div className="p-5 pb-12 sm:p-6 sm:pb-14">
            <p className="type-label text-signal">Day 1 · Tokyo</p>
            <p className="type-display mt-1.5 text-[1.375rem]">The old east side</p>

            <DayArc activities={activities} label="Sample day" animate className="mt-4" />
            <div className="type-label mt-2 flex justify-between text-steel-2">
              <span>6 am</span>
              <span>Midnight</span>
            </div>

            <ol className="mt-5 space-y-3 border-t border-rule pt-4">
              {STOPS.map((stop) => (
                <li key={stop.name} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${BAND_DOT[bandOf(stop.start)]}`}
                  />
                  <div className="min-w-0">
                    <p className="type-data text-[0.75rem] text-steel-2">
                      {formatMinute(stop.start)}
                    </p>
                    <p className="text-[0.9375rem] font-semibold">{stop.name}</p>
                    <p className="text-[0.8125rem] leading-snug text-steel">{stop.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* The overlapping card: depth, and one more claim, without another
          paragraph of copy. */}
      <div
        className="rise absolute -bottom-7 left-2 flex items-center gap-3 rounded-panel bg-surface px-4 py-3.5 shadow-(--shadow-lift) sm:-left-6 lg:-left-10"
        style={{ '--i': 3 } as React.CSSProperties}
      >
        <span className="grad-brand flex size-9 shrink-0 items-center justify-center rounded-edge">
          <Sparkles className="size-4 text-white" />
        </span>
        <span>
          <span className="block text-[0.875rem] font-semibold">Reordered for you</span>
          <span className="block text-[0.75rem] text-steel">1.9 km of walking saved</span>
        </span>
      </div>
    </div>
  );
}
