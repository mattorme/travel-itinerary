/**
 * Currency display.
 *
 * Every figure in this product is an estimate from a model we own, not a quoted
 * price — so it is rounded to something that reads as an estimate. Showing
 * "$1,847.32" would imply a precision that does not exist.
 */
export function formatCurrency(amount: number, currency: string, locale = 'en-AU'): string {
  const rounded = amount >= 1000 ? Math.round(amount / 10) * 10 : Math.round(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${currency} ${rounded.toLocaleString(locale)}`;
  }
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const from = new Date(`${start}T00:00:00Z`);
  const to = end ? new Date(`${end}T00:00:00Z`) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };

  if (!to) return from.toLocaleDateString('en-AU', opts);
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const left = from.toLocaleDateString('en-AU', opts);
  const right = to.toLocaleDateString('en-AU', { ...opts, year: 'numeric' });
  return sameYear ? `${left} – ${right}` : `${from.toLocaleDateString('en-AU', { ...opts, year: 'numeric' })} – ${right}`;
}

const INTEREST_LABELS: Record<string, string> = {
  local_experiences: 'local experiences',
  street_food: 'street food',
  fine_dining: 'fine dining',
  local_food: 'local food',
  gluten_free: 'gluten free',
  no_spicy: 'not too spicy',
  mid_range: 'mid-range',
};

export function humanise(token: string): string {
  return INTEREST_LABELS[token] ?? token.replace(/_/g, ' ');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
