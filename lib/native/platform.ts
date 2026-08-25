'use client';

import { Capacitor } from '@capacitor/core';

/**
 * Where are we running?
 *
 * The whole point of this architecture is that there is one codebase and one
 * deploy. That only works if every native capability has a web fallback and no
 * component ever has to ask "am I in the app" to render correctly — it asks
 * "can I do this here", and gets a sensible answer either way.
 */

export type Platform = 'web' | 'ios' | 'android';

export function platform(): Platform {
  if (typeof window === 'undefined') return 'web';
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/** True inside the native shell, false in any browser including mobile Safari. */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

export function hasPlugin(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isPluginAvailable(name);
}
