'use client';

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { hasPlugin, isNative } from './platform';

/**
 * Haptics.
 *
 * Only on actions with a physical feel to them — saving, liking, cloning,
 * reordering. Not on navigation, and never on anything that fires repeatedly:
 * a buzz on every keystroke is how an app gets deleted.
 *
 * A no-op on the web, so call sites do not branch.
 */
export async function tapFeedback(): Promise<void> {
  if (!isNative() || !hasPlugin('Haptics')) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics are a nicety; a device with them disabled is not an error.
  }
}

export async function successFeedback(): Promise<void> {
  if (!isNative() || !hasPlugin('Haptics')) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* ignore */
  }
}
