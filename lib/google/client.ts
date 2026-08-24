import 'server-only';
import { serverEnv } from '@/lib/env';
import { ServiceError } from '@/lib/observability/errors';

/**
 * Shared transport for Google Maps Platform.
 *
 * Every call goes through here so that retries, timeouts, error mapping and
 * usage accounting are impossible to forget at a call site.
 */

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

export interface GoogleRequest {
  readonly url: string;
  readonly body: unknown;
  /** Comma-separated FieldMask. Required by both Places (New) and Routes. */
  readonly fieldMask: string;
  readonly provider: 'google_places' | 'google_routes';
  readonly timeoutMs?: number;
}

export async function googlePost<T>(request: GoogleRequest): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': serverEnv().GOOGLE_MAPS_SERVER_KEY,
          'X-Goog-FieldMask': request.fieldMask,
        },
        body: JSON.stringify(request.body),
        signal: controller.signal,
        // Google's terms constrain caching of the *content*; the HTTP layer is
        // never allowed to cache it for us. Our own TTL cache is the only cache.
        cache: 'no-store',
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const detail = await response.text().catch(() => '');
      const error = mapStatus(response.status, request.provider, detail);
      if (!error.retryable || attempt === MAX_ATTEMPTS) throw error;
      lastError = error;
    } catch (cause) {
      if (cause instanceof ServiceError) {
        if (!cause.retryable || attempt === MAX_ATTEMPTS) throw cause;
        lastError = cause;
      } else if (cause instanceof Error && cause.name === 'AbortError') {
        lastError = new ServiceError({
          kind: 'timeout',
          provider: request.provider,
          message: `${request.provider} timed out after ${request.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`,
        });
        if (attempt === MAX_ATTEMPTS) throw lastError;
      } else {
        throw new ServiceError({
          kind: 'upstream_unavailable',
          provider: request.provider,
          message: `${request.provider} request failed`,
          cause,
        });
      }
    } finally {
      clearTimeout(timer);
    }

    // Exponential backoff with full jitter — a synchronised retry storm across
    // parallel day generations is how you turn one 429 into fifty.
    const backoff = Math.min(2000, 200 * 2 ** (attempt - 1));
    await sleep(Math.random() * backoff);
  }

  throw lastError instanceof Error
    ? lastError
    : new ServiceError({ kind: 'unknown', provider: request.provider, message: 'exhausted retries' });
}

function mapStatus(status: number, provider: GoogleRequest['provider'], detail: string): ServiceError {
  const base = { provider, status, message: `${provider} returned ${status}: ${detail.slice(0, 400)}` };
  if (status === 429) return new ServiceError({ ...base, kind: 'rate_limited' });
  if (status === 401 || status === 403) return new ServiceError({ ...base, kind: 'auth' });
  if (status === 400 || status === 422) return new ServiceError({ ...base, kind: 'invalid_request' });
  if (status === 404) return new ServiceError({ ...base, kind: 'not_found' });
  if (status >= 500) return new ServiceError({ ...base, kind: 'upstream_unavailable' });
  return new ServiceError({ ...base, kind: 'unknown' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
