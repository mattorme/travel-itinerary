import type { CostBreakdown } from '@/domain/types/itinerary';
import { formatCurrency } from '@/lib/utils/format';

const ROWS = [
  { key: 'accommodation', label: 'Where you stay' },
  { key: 'food', label: 'Food and drink' },
  { key: 'activities', label: 'Things to do' },
  { key: 'localTransport', label: 'Getting around' },
  { key: 'buffer', label: 'Contingency' },
] as const;

/**
 * Budget breakdown.
 *
 * Every figure here is modelled by us — Google supplies price *levels*, not
 * prices — so the panel says so plainly rather than implying a quote.
 */
export function BudgetPanel({
  breakdown,
  currency,
  budgetTotal,
}: {
  breakdown: CostBreakdown;
  currency: string;
  budgetTotal: number | null;
}) {
  const max = Math.max(...ROWS.map((r) => breakdown[r.key]), 1);
  const overBudget = budgetTotal !== null && breakdown.total > budgetTotal;

  return (
    <section className="rounded-card border border-line bg-paper-raised p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl">Estimated cost</h2>
        <p className="text-right">
          <span className="font-display text-2xl">
            ~{formatCurrency(breakdown.total, currency)}
          </span>
        </p>
      </div>

      <dl className="mt-6 space-y-3">
        {ROWS.map((row) => {
          const value = breakdown[row.key];
          if (value <= 0) return null;
          return (
            /* dt and dd must be the only children of a div inside a dl, so the
               bar lives inside the dd rather than in a layout wrapper. */
            <div key={row.key} className="grid grid-cols-[1fr_auto] items-baseline gap-3">
              <dt className="min-w-0 text-sm text-ink-muted">{row.label}</dt>
              <dd className="text-sm tabular-nums">
                {formatCurrency(value, currency)}
                <span
                  className="mt-1 block h-1 rounded-full bg-paper-sunk"
                  aria-hidden
                >
                  <span
                    className="block h-1 rounded-full bg-ink/70"
                    style={{ width: `${Math.round((value / max) * 100)}%` }}
                  />
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      {budgetTotal !== null && (
        <p className={`mt-6 text-sm ${overBudget ? 'text-caution' : 'text-positive'}`}>
          {overBudget
            ? `About ${formatCurrency(breakdown.total - budgetTotal, currency)} over your ${formatCurrency(budgetTotal, currency)} budget.`
            : `Comfortably inside your ${formatCurrency(budgetTotal, currency)} budget.`}
        </p>
      )}

      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
        Estimates based on typical prices for this destination and how you said you like to
        travel. Excludes flights. Actual costs will vary.
      </p>
    </section>
  );
}
