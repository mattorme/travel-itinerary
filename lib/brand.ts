import type { TimeBand } from '@/domain/schedule/time-of-day';

/**
 * Brand colour, as literal values.
 *
 * Everything rendered in a browser takes its colour from the tokens in
 * app/globals.css. This module exists for the one place that cannot: the
 * generated images — the share card, the story card and the app icon — are
 * rasterised by Satori, which has no CSS custom properties and no stylesheet.
 *
 * `app/globals.css` remains the source of truth. These values restate it, and
 * the two have to be changed together; there is no build step that could keep
 * them in step, and adding one to save six literals would cost more than it
 * saves. What this does buy is that the six literals live in exactly one file
 * instead of being copied into every image route.
 */

/** Indigo → violet. The angle differs per surface; the stops never do. */
export const BRAND_FROM = '#4f46e5';
export const BRAND_TO = '#7c3aed';

export function brandGradient(degrees: number): string {
  return `linear-gradient(${degrees}deg, ${BRAND_FROM} 0%, ${BRAND_TO} 100%)`;
}

/**
 * The hours, tuned for a dark ground.
 *
 * Generated images sit on the brand gradient, so they need the bright end of
 * each hue — the web uses the darker variants, which are the ones that hold
 * their own on white. Same three hues, two exposures.
 */
export const BAND_ON_DARK: Record<TimeBand, string> = {
  morning: '#fbbf24',
  afternoon: '#22d3ee',
  evening: '#f472b6',
};
