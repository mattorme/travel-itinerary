'use client';

import { useEffect } from 'react';
import { dayColour, type MapStop } from './types';
import type { GoogleMapHandle } from './use-google-map';

/**
 * Draws the visible stops and their routes, and clears them again.
 *
 * Kept apart from the map's lifecycle because it re-runs on every change to the
 * day filter, whereas the map itself is created once. Combining them meant the
 * two lived in one effect with two very different cadences.
 */
export function useMapStops(
  handle: GoogleMapHandle,
  stops: readonly MapStop[],
  onSelect: (activityId: string) => void,
): void {
  const { mapRef, factoryRef, infoRef, ready } = handle;

  useEffect(() => {
    // Read inside the effect, not during render: by the time this runs the map
    // exists, and `ready` is what guarantees it.
    if (!ready) return;
    const map = mapRef.current;
    const factory = factoryRef.current;
    const info = infoRef.current;
    if (!map || !factory) return;

    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    const lines: google.maps.Polyline[] = [];
    const bounds = new google.maps.LatLngBounds();

    for (const stop of stops) {
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
        info?.setContent(
          `<div style="font-family:system-ui;max-width:220px;line-height:1.35">
             <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a857a">
               Day ${stop.dayIndex}${stop.startLabel ? ` &middot; ${escapeHtml(stop.startLabel)}` : ''}
             </div>
             <div style="font-size:15px;margin-top:4px;color:#17150f">${escapeHtml(stop.title)}</div>
           </div>`,
        );
        info?.open({ map, anchor: marker });
        onSelect(stop.activityId);
      });

      markers.push(marker);
    }

    // One polyline per day, so the route reads as separate days rather than one
    // continuous journey that never happened.
    const byDay = new Map<number, MapStop[]>();
    for (const stop of stops) {
      byDay.set(stop.dayIndex, [...(byDay.get(stop.dayIndex) ?? []), stop]);
    }

    for (const [day, dayStops] of byDay) {
      if (dayStops.length < 2) continue;
      lines.push(
        new google.maps.Polyline({
          map,
          path: [...dayStops]
            .sort((a, b) => a.stopNumber - b.stopNumber)
            .map((stop) => ({ lat: stop.lat, lng: stop.lng })),
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

    let idle: google.maps.MapsEventListener | undefined;
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 48, bottom: 48, left: 32, right: 32 });
      // A single stop otherwise zooms to maximum, which tells you nothing.
      idle = google.maps.event.addListenerOnce(map, 'idle', () => {
        const zoom = map.getZoom();
        if (zoom !== undefined && zoom > 16) map.setZoom(16);
      });
    }

    return () => {
      for (const marker of markers) marker.map = null;
      for (const line of lines) line.setMap(null);
      if (idle) google.maps.event.removeListener(idle);
    };
  }, [mapRef, factoryRef, infoRef, ready, stops, onSelect]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
