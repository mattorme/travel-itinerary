/**
 * Destination cost multipliers, relative to a 1.0 baseline (roughly a mid-tier
 * Western European city).
 *
 * Seeded by country because that is the level at which the data is reliable and
 * it degrades gracefully for anywhere unlisted. Per-city overrides live on the
 * `destinations` row and take precedence — Tokyo and Sapporo are not the same
 * price, and once we have signal for a city we use it.
 *
 * These are estimates. They exist to make a budget feel plausible, not to
 * predict a bill, and the UI says so.
 */
export const COST_INDEX: Readonly<Record<string, number>> = {
  DEFAULT: 1.0,

  // Very high
  CH: 1.75, IS: 1.7, NO: 1.6, SG: 1.45, DK: 1.4, LU: 1.4,
  US: 1.35, AU: 1.3, IE: 1.3, NZ: 1.25, CA: 1.2, GB: 1.2,
  NL: 1.2, SE: 1.2, FI: 1.2, AT: 1.15, BE: 1.15, FR: 1.15,
  DE: 1.1, IT: 1.05, AE: 1.15, IL: 1.3, HK: 1.25,

  // Mid
  JP: 1.0, KR: 0.95, ES: 0.95, PT: 0.85, GR: 0.85, TW: 0.8,
  CZ: 0.8, SI: 0.85, EE: 0.85, HR: 0.8, PL: 0.7, HU: 0.68,
  CL: 0.75, UY: 0.8, CR: 0.85, PA: 0.8, QA: 1.1, SA: 0.95,

  // Lower
  MX: 0.6, BR: 0.6, AR: 0.55, PE: 0.55, CO: 0.5, EC: 0.55,
  TR: 0.5, RO: 0.6, BG: 0.6, RS: 0.55, GE: 0.5, AL: 0.55,
  MA: 0.55, EG: 0.4, TN: 0.45, ZA: 0.55, KE: 0.55, TZ: 0.55,
  TH: 0.5, VN: 0.42, ID: 0.45, MY: 0.55, PH: 0.45, LK: 0.42,
  IN: 0.38, NP: 0.38, KH: 0.42, LA: 0.42, CN: 0.65, MN: 0.5,
  CU: 0.55, GT: 0.5, NI: 0.45, BO: 0.42, PY: 0.5,
};
