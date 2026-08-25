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
 * One colour per day, cycling after eight.
 *
 * Chosen to stay distinguishable at marker size and to sit against the warm
 * paper background without any of them reading as the accent colour, which
 * belongs to actions.
 */
export const DAY_COLOURS: readonly string[] = [
  '#C2410C',
  '#2F6B4F',
  '#2F4A6B',
  '#8C3F63',
  '#7A6320',
  '#3F5F6B',
  '#6B3F2F',
  '#4A3F6B',
];

export function dayColour(dayIndex: number): string {
  return DAY_COLOURS[(dayIndex - 1) % DAY_COLOURS.length] as string;
}
