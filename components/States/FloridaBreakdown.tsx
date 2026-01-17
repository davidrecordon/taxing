import { memo } from "react";
import { TaxCalculationResult } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import TaxSummarySection from "../shared/TaxSummarySection";

interface Props {
  result: TaxCalculationResult;
}

export default memo(function FloridaBreakdown({ result }: Props) {
  const hasWithholding = result.withheld > 0 || result.estimatedPaid > 0;

  return (
    <div className="theme-card p-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 mb-4 font-display">
        Florida Tax Breakdown
      </h2>

      {/* No Income Tax Notice */}
      <div className="bg-positive-bg p-3 rounded-[var(--radius-md)] mb-4">
        <p className="text-sm text-positive font-medium">
          Florida has no state income tax on wages, capital gains, or other
          personal income.
        </p>
      </div>

      {/* Payment Summary - only show if there's withholding to refund */}
      {hasWithholding ? (
        <TaxSummarySection
          totalTax={0}
          withheld={result.withheld}
          estimatedPaid={result.estimatedPaid}
          remainingOwed={0}
          refundDue={result.refundDue}
          taxLabel="Florida"
          showEffectiveRates={false}
        />
      ) : (
        <div className="bg-secondary p-3 rounded-[var(--radius-md)]">
          <div className="flex justify-between font-medium text-text-primary">
            <span>Florida Income Tax</span>
            <span className="font-mono text-positive">
              {formatCurrency(0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
