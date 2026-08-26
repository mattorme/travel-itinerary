/**
 * Shared column lists.
 *
 * A select string is a contract between a query and whatever renders it, and
 * this one was written out in five files. Sharing it means a card can never be
 * handed a row missing the column it renders, and — because supabase-js infers
 * result types from the literal — every caller gets a fully typed row for free,
 * including when the list is interpolated into an embedded relation.
 *
 * `as const` is load-bearing: widen it to `string` and the inference is gone.
 */

/**
 * Everything `components/trip/trip-card.tsx` renders, and nothing else.
 *
 * One template literal rather than concatenated pieces: `'a' + 'b'` widens to
 * `string`, and the moment it does, every caller silently falls back to an
 * untyped row.
 */
export const TRIP_CARD_COLUMNS = `
  id, slug, title, subtitle, duration_days, currency, estimated_cost_total,
  hero_image_url, hero_credit, clone_count, like_count, interests, travel_style,
  profiles:owner_id ( username, display_name, avatar_url )
`;
