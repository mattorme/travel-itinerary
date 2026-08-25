'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Layers, Maximize2, X } from 'lucide-react';
import { publicEnv } from '@/lib/public-env';
import { cn } from '@/lib/utils/cn';
import { dayColour, type MapStop } from './types';

/**
 * The itinerary map.
 *
 * Google Maps rather than a lighter alternative, and not by preference: the
 * Maps Platform terms prohibit using Places content — which is where every
 * coordinate here comes from — with a non-Google map. Content may be shown with
 * *no* map, which is why the no-key path renders nothing rather than
 * substituting another provider.
 *
 * Three deliberate constraints:
 *
 *  - Loaded lazily, on scroll. Dynamic Maps is billed per load and this sits on
 *    a public page built to be shared; paying for every visitor who never
 *    scrolls to it would be a poor trade.
 *  - It reinforces the itinerary rather than competing with it: fixed height,
 *    in the flow, with a full-screen mode for when someone actually wants to
 *    explore.
 *  - Selecting a day filters the map and scrolls the itinerary to match, so the
 *    two views never disagree about what you are looking at.
 */

interface MarkerFactory {
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  PinElement: typeof google.maps.marker.PinElement;
}

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
  const mapRef = useRef<google.maps.Map | null>(null);
  const factoryRef = useRef<MarkerFactory | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const [shouldLoad, setShouldLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const apiKey = publicEnv.mapsBrowserKey;
  const visible = useMemo(
    () => (activeDay === null ? stops : stops.filter((s) => s.dayIndex === activeDay)),
    [stops, activeDay],
  );

  // Defer the script until the map is nearly on screen.
  useEffect(() => {
    if (!apiKey || shouldLoad) return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [apiKey, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !apiKey || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        // Functional API: `setOptions` must run before the first import, and
        // the first import is what actually fetches the script.
        setOptions({ key: apiKey, v: 'weekly' });
        const [maps, marker] = await Promise.all([
          importLibrary('maps'),
          importLibrary('marker'),
        ]);
        if (cancelled || !containerRef.current) return;

        mapRef.current = new maps.Map(containerRef.current, {
          // A Map ID is required for advanced markers. DEMO_MAP_ID works for
          // development; production should use a styled map from the console.
          mapId: publicEnv.mapsMapId ?? 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative', // never hijack page scroll on a phone
          clickableIcons: false,
        });
        factoryRef.current = {
          AdvancedMarkerElement: marker.AdvancedMarkerElement,
          PinElement: marker.PinElement,
        };
        infoRef.current = new maps.InfoWindow({ disableAutoPan: false });
        setReady(true);
      } catch (error) {
        console.warn('[map] failed to load', error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, apiKey]);

  const focusActivity = useCallback((activityId: string) => {
    const node = document.getElementById(`activity-${activityId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.setAttribute('data-map-focus', 'true');
    setTimeout(() => node.removeAttribute('data-map-focus'), 2200);
  }, []);

  // Redraw markers and routes whenever the visible set changes.
  useEffect(() => {
    const map = mapRef.current;
    const factory = factoryRef.current;
    if (!map || !factory || !ready) return;

    for (const existing of markersRef.current) existing.map = null;
    for (const line of linesRef.current) line.setMap(null);
    markersRef.current = [];
    linesRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    for (const stop of visible) {
      const position = { lat: stop.lat, lng: stop.lng };
      bounds.extend(position);

      const pin = new factory.PinElement({
        background: dayColour(stop.dayIndex),
        borderColor: '#FDFBF7',
        glyphColor: '#FDFBF7',
        glyph: String(stop.stopNumber),
        scale: 1.05,
      });

      const marker = new factory.AdvancedMarkerElement({
        map,
        position,
        title: stop.title,
        content: pin.element,
        gmpClickable: true,
      });

      marker.addListener('click', () => {
        infoRef.current?.setContent(
          `<div style="font-family:system-ui;max-width:220px;line-height:1.35">
             <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a857a">
               Day ${stop.dayIndex}${stop.startLabel ? ` &middot; ${escapeHtml(stop.startLabel)}` : ''}
             </div>
             <div style="font-size:15px;margin-top:4px;color:#17150f">${escapeHtml(stop.title)}</div>
           </div>`,
        );
        infoRef.current?.open({ map, anchor: marker });
        focusActivity(stop.activityId);
      });

      markersRef.current.push(marker);
    }

    // One polyline per day, so the route reads as separate days rather than one
    // continuous journey that never happened.
    const byDay = new Map<number, MapStop[]>();
    for (const stop of visible) {
      byDay.set(stop.dayIndex, [...(byDay.get(stop.dayIndex) ?? []), stop]);
    }

    for (const [day, dayStops] of byDay) {
      if (dayStops.length < 2) continue;
      linesRef.current.push(
        new google.maps.Polyline({
          map,
          path: [...dayStops]
            .sort((a, b) => a.stopNumber - b.stopNumber)
            .map((s) => ({ lat: s.lat, lng: s.lng })),
          strokeColor: dayColour(day),
          // Dotted: these are straight lines between stops, not the road you
          // would actually take. A solid line would imply a precision the map
          // does not have.
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 3 },
              offset: '0',
              repeat: '12px',
            },
          ],
        }),
      );
    }

    if (bounds.isEmpty()) return undefined;

    map.fitBounds(bounds, { top: 48, bottom: 48, left: 32, right: 32 });
    // A single stop otherwise zooms to maximum, which tells you nothing.
    const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom();
      if (zoom !== undefined && zoom > 16) map.setZoom(16);
    });
    return () => google.maps.event.removeListener(listener);
  }, [visible, ready, focusActivity]);

  // Escape closes full screen; the body must not scroll behind it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
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
      <div className="rounded-card border border-dashed border-line-strong bg-paper-sunk p-5 text-sm text-ink-muted">
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
        'overflow-hidden rounded-card border border-line bg-paper-sunk',
        expanded && 'fixed inset-0 z-50 rounded-none border-0',
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-paper-raised px-3 py-2">
        <Layers className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
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
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Close full screen map' : 'Expand map'}
          className="shrink-0 rounded-full p-2 text-ink-muted hover:bg-paper-sunk hover:text-ink"
        >
          {expanded ? <X className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>

      <div
        ref={containerRef}
        className={cn('w-full bg-paper-sunk', expanded ? 'h-[calc(100dvh-3rem)]' : 'h-72 sm:h-96')}
      >
        {!ready && !failed && (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Loading map…
          </div>
        )}
        {failed && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-muted">
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
        active ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-paper-sunk hover:text-ink',
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
