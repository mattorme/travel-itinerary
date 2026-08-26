'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { publicEnv } from '@/lib/public-env';

export interface MarkerFactory {
  readonly AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  readonly PinElement: typeof google.maps.marker.PinElement;
}

/**
 * The refs themselves, not their current values.
 *
 * Reading `.current` during render is both a lint error and actually wrong
 * here: a consumer would capture whatever the ref held at render time and keep
 * it until the next one. Handing over the ref objects — which are stable — lets
 * the consumer read them inside its own effect, where the value is current.
 * `ready` is the state that tells it when that is worth doing.
 */
export interface GoogleMapHandle {
  readonly mapRef: RefObject<google.maps.Map | null>;
  readonly factoryRef: RefObject<MarkerFactory | null>;
  readonly infoRef: RefObject<google.maps.InfoWindow | null>;
  readonly ready: boolean;
  readonly failed: boolean;
}

/**
 * Loads Google Maps and creates the map instance.
 *
 * Split out of the component so the map's lifecycle — a lazy script load, an
 * async import, an instance that must not be recreated — is separate from the
 * chrome around it. The component was 273 lines with all three concerns in one
 * function.
 *
 * The load is deferred until the container is nearly on screen. Dynamic Maps is
 * billed per load and this sits on a page built to be shared, so a visitor who
 * reads the hero and leaves should cost nothing.
 */
export function useGoogleMap(container: RefObject<HTMLDivElement | null>): GoogleMapHandle {
  const mapRef = useRef<google.maps.Map | null>(null);
  const factoryRef = useRef<MarkerFactory | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const [shouldLoad, setShouldLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const apiKey = publicEnv.mapsBrowserKey;

  useEffect(() => {
    if (!apiKey || shouldLoad) return;
    const node = container.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [apiKey, shouldLoad, container]);

  useEffect(() => {
    if (!shouldLoad || !apiKey || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        // Functional API: setOptions must run before the first import, and the
        // first import is what actually fetches the script.
        setOptions({ key: apiKey, v: 'weekly' });
        const [maps, marker] = await Promise.all([
          importLibrary('maps'),
          importLibrary('marker'),
        ]);
        if (cancelled || !container.current) return;

        mapRef.current = new maps.Map(container.current, {
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
  }, [shouldLoad, apiKey, container]);

  return { mapRef, factoryRef, infoRef, ready, failed };
}
