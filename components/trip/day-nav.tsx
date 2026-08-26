'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Day navigation.
 *
 * A horizontal scroller rather than a sidebar: the primary viewport is a phone,
 * and a twelve-day trip has to be skimmable with a thumb. Deliberately carries
 * no colour of its own — the map below runs its own day colours, and a third
 * colour system on one page is one too many.
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
      className="sticky top-18 z-30 -mx-4 border-b border-rule bg-paper/90 px-4 backdrop-blur-md sm:mx-0 sm:px-0"
    >
      <ul className="hide-scrollbar flex gap-2 overflow-x-auto py-2.5">
        {days.map((day) => {
          const isActive = active === day.dayIndex;
          return (
            <li key={day.dayIndex}>
              <a
                href={`#day-${day.dayIndex}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'type-label flex shrink-0 items-center rounded-full px-3 py-2 whitespace-nowrap transition-colors',
                  isActive
                    ? 'grad-brand text-white'
                    : 'text-steel-2 hover:bg-signal-wash hover:text-signal',
                )}
              >
                Day {day.dayIndex}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
