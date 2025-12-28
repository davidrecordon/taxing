import { formatCurrency, formatPercent } from '@/lib/formatters';

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
export default function TaxSummarySection({
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
    <div className="bg-blue-50 p-3 rounded mb-4 space-y-2">
      <div className="flex justify-between font-medium">
        <span>Total {taxLabel} Tax</span>
        <span className="font-mono">{formatCurrency(totalTax)}</span>
      </div>
      {withheld > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Less: Withheld</span>
          <span className="font-mono">-{formatCurrency(withheld)}</span>
        </div>
      )}
      {estimatedPaid > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Less: Estimated Paid</span>
          <span className="font-mono">-{formatCurrency(estimatedPaid)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-lg pt-2 border-t border-blue-200">
        {remainingOwed > 0 ? (
          <>
            <span>Estimated Tax Still Owed</span>
            <span className="text-red-600 font-mono">
              {formatCurrency(remainingOwed)}
            </span>
          </>
        ) : totalTax > 0 ? (
          <>
            <span>Estimated Refund</span>
            <span className="text-green-600 font-mono">
              {formatCurrency(refundDue)}
            </span>
          </>
        ) : (
          <>
            <span>No Tax Due</span>
            <span className="text-green-600 font-mono">$0</span>
          </>
        )}
      </div>
      {showEffectiveRates && effectiveRates && (
        <div className="pt-2 mt-2 border-t border-blue-200 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Effective Rate (on taxable income)</span>
            <span className="font-mono">{formatPercent(effectiveRates.onTaxableIncome, 1)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Effective Rate (on gross income)</span>
            <span className="font-mono">{formatPercent(effectiveRates.onGrossIncome, 1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
