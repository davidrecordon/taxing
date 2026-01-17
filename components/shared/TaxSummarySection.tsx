import { memo } from "react";
import { formatCurrency, formatPercent } from "@/lib/formatters";

interface EffectiveRates {
  onTaxableIncome: number;
  onGrossIncome: number;
}

interface TaxSummarySectionProps {
  /** Total tax amount */
  totalTax: number;
  /** Amount withheld from paychecks */
  withheld: number;
  /** Estimated tax payments already made */
  estimatedPaid: number;
  /** Amount still owed (0 if refund due) */
  remainingOwed: number;
  /** Refund amount (0 if tax owed) */
  refundDue: number;
  /** Label for the jurisdiction (e.g., "Federal", "California", "Washington") */
  taxLabel: string;
  /** Whether to show effective tax rates */
  showEffectiveRates?: boolean;
  /** Effective rate calculations (required if showEffectiveRates is true) */
  effectiveRates?: EffectiveRates;
}

/**
 * Reusable tax summary section showing total tax, payments, and amount owed/refund.
 * Used by Federal, California, Washington, and other breakdown components.
 */
export default memo(function TaxSummarySection({
  totalTax,
  withheld,
  estimatedPaid,
  remainingOwed,
  refundDue,
  taxLabel,
  showEffectiveRates = false,
  effectiveRates,
}: TaxSummarySectionProps) {
  return (
    <div className="bg-accent-subtle p-3 rounded-[var(--radius-md)] mb-4 space-y-2">
      <div className="flex justify-between font-medium text-text-primary">
        <span>Total {taxLabel} Tax</span>
        <span className="font-mono">{formatCurrency(totalTax)}</span>
      </div>
      {withheld > 0 && (
        <div className="flex justify-between text-sm text-positive">
          <span>Less: Withheld</span>
          <span className="font-mono">-{formatCurrency(withheld)}</span>
        </div>
      )}
      {estimatedPaid > 0 && (
        <div className="flex justify-between text-sm text-positive">
          <span>Less: Estimated Paid</span>
          <span className="font-mono">-{formatCurrency(estimatedPaid)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-lg pt-2 border-t border-[var(--color-border-accent)]">
        {remainingOwed > 0 ? (
          <>
            <span className="text-text-primary">Estimated Tax Still Owed</span>
            <span className="text-negative font-mono">
              {formatCurrency(remainingOwed)}
            </span>
          </>
        ) : totalTax > 0 ? (
          <>
            <span className="text-text-primary">Estimated Refund</span>
            <span className="text-positive font-mono">
              {formatCurrency(refundDue)}
            </span>
          </>
        ) : (
          <>
            <span className="text-text-primary">No Tax Due</span>
            <span className="text-positive font-mono">$0</span>
          </>
        )}
      </div>
      {showEffectiveRates && effectiveRates && (
        <div className="pt-2 mt-2 border-t border-[var(--color-border-accent)] space-y-1">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Effective Rate (on taxable income)</span>
            <span className="font-mono">
              {formatPercent(effectiveRates.onTaxableIncome, 1)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Effective Rate (on gross income)</span>
            <span className="font-mono">
              {formatPercent(effectiveRates.onGrossIncome, 1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
