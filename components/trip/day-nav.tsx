'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { dayColour } from './map/types';

/**
 * Day navigation, as a line index.
 *
 * A horizontal scroller rather than a sidebar: the primary viewport is a phone,
 * and a twelve-day trip has to be skimmable with a thumb. Each entry carries
 * its route colour, so the strip doubles as the legend for the timeline and the
 * map below it.
 */
export function DayNav({ days }: { days: readonly { dayIndex: number; title: string }[] }) {
  const [active, setActive] = useState(days[0]?.dayIndex ?? 1);

  useEffect(() => {
    const sections = days
      .map((d) => document.getElementById(`day-${d.dayIndex}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const index = Number(visible.target.id.replace('day-', ''));
          if (!Number.isNaN(index)) setActive(index);
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [days]);

  if (days.length < 2) return null;

  return (
    <nav
      aria-label="Days"
      data-print-hide
      className="sticky top-14 z-30 -mx-4 border-b border-rule bg-paper/95 px-4 backdrop-blur-sm sm:mx-0 sm:px-0"
    >
      <ul className="hide-scrollbar flex gap-4 overflow-x-auto py-3">
        {days.map((day) => {
          const colour = dayColour(day.dayIndex);
          const isActive = active === day.dayIndex;
          return (
            <li key={day.dayIndex}>
              <a
                href={`#day-${day.dayIndex}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'type-label flex shrink-0 items-center gap-2 whitespace-nowrap py-1 transition-colors',
                  isActive ? 'text-ink' : 'text-steel-2 hover:text-ink',
                )}
              >
                <span
                  className="h-2.5 w-6 shrink-0"
                  style={{ backgroundColor: colour, opacity: isActive ? 1 : 0.35 }}
                  aria-hidden
                />
                Day {day.dayIndex}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
