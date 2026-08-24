'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Sticky day navigation.
 *
 * A horizontal scroller rather than a sidebar, because the primary viewport is
 * a phone and a 12-day trip needs to be skimmable with a thumb.
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
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [days]);

  if (days.length < 2) return null;

  return (
    <nav
      aria-label="Days"
      className="sticky top-16 z-30 -mx-5 border-b border-line bg-paper/90 px-5 backdrop-blur-md"
    >
      <ul className="hide-scrollbar flex gap-1 overflow-x-auto py-3">
        {days.map((day) => (
          <li key={day.dayIndex}>
            <a
              href={`#day-${day.dayIndex}`}
              aria-current={active === day.dayIndex ? 'true' : undefined}
              className={cn(
                'block rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors',
                active === day.dayIndex
                  ? 'bg-ink text-paper'
                  : 'text-ink-muted hover:bg-paper-sunk hover:text-ink',
              )}
            >
              Day {day.dayIndex}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
