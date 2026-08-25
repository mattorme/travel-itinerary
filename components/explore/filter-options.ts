export const SORTS = [
  { key: 'relevance', label: 'Best match' },
  { key: 'popular', label: 'Most copied' },
  { key: 'liked', label: 'Most liked' },
  { key: 'recent', label: 'Newest' },
] as const;

export type SortKey = (typeof SORTS)[number]['key'];

/**
 * Duration is the filter people actually reach for — "I have a week" is how
 * trips get planned, far more often than "I want a mid-range trip".
 */
export const DURATION_BANDS = [
  { key: 'short', label: 'Long weekend', min: 1, max: 4 },
  { key: 'week', label: 'About a week', min: 5, max: 9 },
  { key: 'long', label: 'Two weeks +', min: 10, max: 60 },
] as const;
