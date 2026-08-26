export interface MapStop {
  readonly activityId: string;
  readonly dayIndex: number;
  /** 1-based position within its day, used for the marker label. */
  readonly stopNumber: number;
  readonly title: string;
  readonly kind: string;
  readonly lat: number;
  readonly lng: number;
  readonly startLabel: string | null;
}

/**
 * The route palette — one line colour per day, cycling after eight.
 *
 * This is the product's identity, not a decoration: the same value colours a
 * day's rail on the timeline, its badge in the day index, its markers and
 * polyline on the map, and its cover art. Every entry clears 4.5:1 on white so
 * it can carry small text, and none of them is the signal blue, which is
 * reserved for actions.
 */
export const DAY_COLOURS: readonly string[] = [
  '#D6321F',
  '#0B6E4F',
  '#1B3BD8',
  '#B0187E',
  '#8A5A00',
  '#00697A',
  '#7A2FA8',
  '#A8431C',
];

export function dayColour(dayIndex: number): string {
  return DAY_COLOURS[(dayIndex - 1) % DAY_COLOURS.length] as string;
}
