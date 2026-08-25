'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initNativeShell } from '@/lib/native/shell';
import { isNative, platform } from '@/lib/native/platform';

/**
 * Mounted once in the root layout.
 *
 * Marks the document so CSS can adapt (safe areas, no sticky browser chrome)
 * and starts the native listeners. Renders nothing, and does nothing at all in
 * a browser.
 */
export function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (isNative()) {
      document.documentElement.dataset.native = platform();
    }
    let teardown: (() => void) | undefined;
    void initNativeShell((path) => router.push(path as never)).then((off) => {
      teardown = off;
    });
    return () => teardown?.();
  }, [router]);

  return null;
}
