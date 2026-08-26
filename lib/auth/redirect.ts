/**
 * Where an auth callback is allowed to send someone.
 *
 * Both OAuth and magic-link callbacks take a `next` parameter from a URL, which
 * makes it attacker-controlled. Anything that is not a same-site absolute path
 * is an open redirect, so this is deliberately one function rather than a copy
 * in each handler.
 */
const FALLBACK = '/me';

export function safeRedirectPath(next: string | null | undefined): string {
  if (!next) return FALLBACK;
  // Must be a rooted path, and must not be protocol-relative ("//evil.com").
  if (!next.startsWith('/') || next.startsWith('//')) return FALLBACK;
  // A backslash is treated as a slash by some parsers.
  if (next.includes('\\')) return FALLBACK;
  return next;
}
