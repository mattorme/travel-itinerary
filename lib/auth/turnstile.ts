import 'server-only';
import { serverEnv } from '@/lib/env';

/**
 * Cloudflare Turnstile verification.
 *
 * Anonymous generation is otherwise an unauthenticated way to spend our money —
 * this is the cheapest thing standing between a scraper and the OpenAI bill.
 *
 * With no secret configured (local dev) verification is skipped, and says so
 * loudly rather than silently passing in production.
 */
export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  const secret = serverEnv().TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (serverEnv().NODE_ENV === 'production') {
      console.error('[turnstile] no secret configured in production — anonymous generation is unprotected');
    }
    return true;
  }

  if (!token) return false;

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      cache: 'no-store',
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error('[turnstile] verification failed', error);
    return false;
  }
}
