'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Maximize2, X } from 'lucide-react';
import { publicEnv } from '@/lib/public-env';
import { cn } from '@/lib/utils/cn';
import { dayColour, type MapStop } from './types';
import { useGoogleMap } from './use-google-map';
import { useMapStops } from './use-map-stops';

/**
 * The itinerary map.
 *
 * Google Maps rather than a lighter alternative, and not by preference: the
 * Maps Platform terms prohibit using Places content — which is where every
 * coordinate here comes from — with a non-Google map. Content may be shown with
 * *no* map, which is why the no-key path renders nothing rather than
 * substituting another provider.
 *
 * This component is now only the chrome: the day filter, the full-screen
 * toggle, and the two-way link with the itinerary. Loading the API lives in
 * useGoogleMap and drawing lives in useMapStops.
 */
export function TripMap({
  stops,
  dayCount,
  title,
}: {
  stops: readonly MapStop[];
  dayCount: number;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const apiKey = publicEnv.mapsBrowserKey;
  const visible = useMemo(
    () => (activeDay === null ? stops : stops.filter((stop) => stop.dayIndex === activeDay)),
    [stops, activeDay],
  );

  const focusActivity = useCallback((activityId: string) => {
    const node = document.getElementById(`activity-${activityId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.setAttribute('data-map-focus', 'true');
    setTimeout(() => node.removeAttribute('data-map-focus'), 2200);
  }, []);

  const handle = useGoogleMap(containerRef);
  useMapStops(handle, visible, focusActivity);

  // Escape closes full screen; the body must not scroll behind it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  // Without a browser key there is no compliant map to show. Say so in
  // development; say nothing at all in production.
  if (!apiKey) {
    return process.env.NODE_ENV === 'development' ? (
      <div className="rounded-panel border border-dashed border-rule-2 bg-sunk p-5 text-sm text-steel">
        <p className="font-medium text-ink">Map hidden</p>
        <p className="mt-1.5 leading-relaxed">
          Set <code className="rounded bg-paper px-1">NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY</code> to
          show the itinerary map. Google&apos;s terms do not permit rendering Places content on a
          non-Google map, so there is deliberately no fallback map.
        </p>
      </div>
    ) : null;
  }

  if (stops.length === 0) return null;

  return (
    <section
      aria-label={`Map of ${title}`}
      className={cn(
        'overflow-hidden rounded-panel border border-rule bg-sunk',
        expanded && 'fixed inset-0 z-50 rounded-none border-0',
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-rule bg-surface px-3 py-2">
        <Layers className="size-3.5 shrink-0 text-steel-2" aria-hidden />
        <div className="hide-scrollbar flex flex-1 gap-1 overflow-x-auto">
          <DayChip active={activeDay === null} onClick={() => setActiveDay(null)}>
            All days
          </DayChip>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
            <DayChip
              key={day}
              active={activeDay === day}
              colour={dayColour(day)}
              onClick={() => setActiveDay(activeDay === day ? null : day)}
            >
              Day {day}
            </DayChip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'Close full screen map' : 'Expand map'}
          className="shrink-0 rounded-full p-2 text-steel hover:bg-sunk hover:text-ink"
        >
          {expanded ? <X className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>

      <div
        ref={containerRef}
        className={cn('w-full bg-sunk', expanded ? 'h-[calc(100dvh-3rem)]' : 'h-72 sm:h-96')}
      >
        {!handle.ready && !handle.failed && (
          <div className="flex h-full items-center justify-center text-sm text-steel-2">
            Loading map…
          </div>
        )}
        {handle.failed && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-steel">
            The map could not load. The itinerary below is unaffected.
          </div>
        )}
      </div>
    </section>
  );
}

function DayChip({
  active,
  colour,
  onClick,
  children,
}: {
  active: boolean;
  colour?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
        active ? 'bg-ink text-paper' : 'text-steel hover:bg-sunk hover:text-ink',
      )}
    >
      {colour && (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: active ? 'currentColor' : colour }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
