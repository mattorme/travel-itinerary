import type { NextRequest } from 'next/server';

/**
 * Caller IP, for rate limiting.
 *
 * Trusts the leftmost x-forwarded-for entry only because Vercel rewrites the
 * header at the edge. Behind any other proxy this must be revisited — a
 * spoofable IP is a rate limiter that does nothing.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}

/**
 * A stable, non-identifying handle for one visitor on one day.
 *
 * Salted with the trip id and the date so it cannot be correlated across trips
 * or across days, and cannot be reversed to an IP. This is what makes view
 * dedupe possible without storing anything personal.
 */
export async function actorHash(ip: string, userAgent: string, salt: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${ip}|${userAgent}|${salt}|${day}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
