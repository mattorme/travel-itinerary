'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A Google Place Photo, served through our proxy.
 *
 * Lazy by default and hidden entirely on failure: the photo endpoint 404s when
 * the place's cached content has lapsed, and an activity card reads perfectly
 * well without a picture. A broken image icon would be worse than no image.
 *
 * Not a next/image: the URL is our own route, the upstream dimensions are
 * unknown, and Next's optimiser would add a second cache layer over content
 * whose retention is already contractually bounded.
 */
export function PlacePhoto({
  placeId,
  alt,
  className,
}: {
  placeId: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) return null;

  return (
    <figure className={cn('overflow-hidden rounded-xl bg-paper-sunk', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/place-photo/${placeId}?w=800`}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'aspect-[3/2] w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
      <figcaption className="sr-only">Photo from Google Maps</figcaption>
    </figure>
  );
}
