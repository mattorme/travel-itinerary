'use client';

import { Share } from '@capacitor/share';
import { hasPlugin, isNative } from './platform';

/**
 * Sharing, in order of preference:
 *
 *   1. the native share sheet, inside the app
 *   2. the Web Share API, on a phone browser
 *   3. copy to clipboard, everywhere else
 *
 * Sharing is the growth loop, so it degrades rather than disappears. The return
 * value says which path was taken so the caller can attribute the share to a
 * channel and show the right confirmation.
 */
export type ShareOutcome = 'native' | 'web' | 'clipboard' | 'dismissed' | 'failed';

export async function shareLink(args: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareOutcome> {
  if (isNative() && hasPlugin('Share')) {
    try {
      await Share.share({ title: args.title, text: args.text, url: args.url, dialogTitle: 'Share this trip' });
      return 'native';
    } catch (error) {
      // The plugin rejects on cancel, which is not a failure.
      return isCancellation(error) ? 'dismissed' : 'failed';
    }
  }

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title: args.title, text: args.text, url: args.url });
      return 'web';
    } catch (error) {
      if (isCancellation(error)) return 'dismissed';
    }
  }

  try {
    await navigator.clipboard.writeText(args.url);
    return 'clipboard';
  } catch {
    return 'failed';
  }
}

function isCancellation(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError' || /cancel/i.test(error.message);
  }
  return false;
}
