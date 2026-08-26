/**
 * Minutes-since-midnight <-> Postgres `time` values.
 *
 * The domain stores times as a minute count; the database stores `time`. Both
 * halves of that conversion existed three times over, which is exactly the kind
 * of thing that drifts — one copy handling after-midnight wrap and another not.
 */

/** `1410` -> `"23:30:00"`. Wraps past midnight, so a 25:00 end time is 01:00. */
export function minuteToSqlTime(minute: number): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const minutes = String(wrapped % 60).padStart(2, '0');
  return `${hours}:${minutes}:00`;
}

/** `"23:30:00"` -> `1410`. */
export function sqlTimeToMinute(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}
