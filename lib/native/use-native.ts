'use client';

import { useSyncExternalStore } from 'react';
import { isNative } from './platform';

/**
 * "Am I in the native app?", safely.
 *
 * `Capacitor.isNativePlatform()` is a client-only value, so reading it during
 * render would desync hydration, and reading it in an effect causes a cascading
 * re-render. `useSyncExternalStore` is the construct designed for exactly this:
 * a server snapshot of `false`, a client snapshot of the real value, and no
 * extra render pass.
 *
 * The value never changes for the life of the document, so the subscribe
 * function is a no-op.
 */
const noopSubscribe = (): (() => void) => () => {};

export function useIsNative(): boolean {
  return useSyncExternalStore(noopSubscribe, isNative, () => false);
}

/** Whether any share sheet is available — the OS one, or the Web Share API. */
export function useCanShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isNative() || (typeof navigator !== 'undefined' && 'share' in navigator),
    () => false,
  );
}
