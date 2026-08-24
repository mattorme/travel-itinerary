'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { publicEnv } from '@/lib/public-env';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, any>) => string;
      remove: (id: string) => void;
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Invisible bot check in front of anonymous generation.
 *
 * Renders nothing when no site key is configured (local dev) — the server side
 * skips verification in the same case, and warns if that happens in production.
 */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = publicEnv.turnstileSiteKey;

  useEffect(() => {
    if (!siteKey || !ref.current || widgetId.current) return;
    const render = () => {
      if (!window.turnstile || !ref.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        size: 'flexible',
        callback: (token: string) => onToken(token),
        'error-callback': () => onToken(null),
        'expired-callback': () => onToken(null),
      });
    };
    render();
    const timer = setInterval(render, 400);
    return () => clearInterval(timer);
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div ref={ref} className="mt-6" />
    </>
  );
}
