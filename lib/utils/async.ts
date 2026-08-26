/**
 * Small async utilities.
 *
 * `mapWithConcurrency` previously lived in the Places cache module and was
 * imported from the pipeline, which made a general-purpose helper look like a
 * caching concern.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` over every item with a bounded number in flight, preserving order.
 *
 * Used wherever we fan out to a rate-limited provider: unbounded
 * `Promise.all` over forty places is how you turn one generation into a 429.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T);
    }
  });

  await Promise.all(workers);
  return results;
}
