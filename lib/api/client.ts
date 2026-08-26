/**
 * The browser's calls to our own API.
 *
 * Centralised so that a component never builds a URL, decides a method, or
 * decodes an error shape. There were only two of these and they had already
 * drifted: one surfaced the server's message, the other silently swallowed
 * every failure.
 *
 * Each function returns a discriminated result rather than throwing, because
 * every caller is a component that has to render the failure.
 */

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

const GENERIC_ERROR = 'Something went wrong. Please try again.';

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: string })
      | null;

    if (!response.ok) {
      // The server writes these for the person reading them; anything missing
      // means an unexpected failure, not a message worth showing.
      return { ok: false, error: payload?.error ?? GENERIC_ERROR };
    }
    if (!payload) return { ok: false, error: GENERIC_ERROR };

    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: 'We could not reach the server. Check your connection.' };
  }
}

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return ((await response.json()) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export interface StartedGeneration {
  readonly tripId: string;
  readonly jobId: string;
}

export function startGeneration(
  trip: unknown,
  turnstileToken: string | null,
): Promise<ApiResult<StartedGeneration>> {
  return post<StartedGeneration>('/api/trips/generate', { trip, turnstileToken });
}

export interface DestinationSuggestion {
  readonly placeId: string;
  readonly primary: string;
  readonly secondary: string | null;
}

/**
 * Destination autocomplete. Failure is an empty list, not an error: someone
 * typing a city name can carry on perfectly well without suggestions.
 */
export async function suggestDestinations(
  query: string,
  sessionToken: string,
): Promise<readonly DestinationSuggestion[]> {
  const params = new URLSearchParams({ q: query, session: sessionToken });
  const data = await get<{ suggestions?: DestinationSuggestion[] }>(
    `/api/places/autocomplete?${params}`,
    {},
  );
  return data.suggestions ?? [];
}
