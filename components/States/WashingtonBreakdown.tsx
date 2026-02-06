import { memo, useMemo } from "react";
import { TaxCalculationResult, WashingtonLimitsData } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { calculateEffectiveRates } from "@/lib/taxUtils";
import { TaxYear } from "@/lib/config";
import BracketTable from "../shared/BracketTable";
import TaxSummarySection from "../shared/TaxSummarySection";
import allWashingtonLimits from "@/data/washington-limits.json";

interface Props {
  result: TaxCalculationResult;
  taxYear: TaxYear;
}

export default memo(function WashingtonBreakdown({ result, taxYear }: Props) {
  const limits = useMemo(
    () => allWashingtonLimits[taxYear] as WashingtonLimitsData,
    [taxYear],
  );

  const hasLTCG = result.longTermCapitalGains > 0;

  // Calculate net LTCG for display
  const netLTCG =
    result.longTermCapitalGains - result.longTermLossCarryoverOffset;

  return (
    <div className="theme-card p-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 mb-4 font-display">
        Washington Tax Breakdown
      </h2>

      {/* No Income Tax Notice */}
      <div className="bg-accent-subtle p-3 rounded-[var(--radius-md)] mb-4">
        <p className="text-sm text-accent">
          Washington has no income tax on wages or short-term capital gains.
        </p>
      </div>

      {hasLTCG ? (
        <>
          {/* Capital Gains Flow */}
          <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4 space-y-2">
            <div className="flex justify-between text-text-primary">
              <span>Long-Term Capital Gains</span>
              <span className="font-mono">
                {formatCurrency(result.longTermCapitalGains)}
              </span>
            </div>
            {result.longTermLossCarryoverOffset > 0 && (
              <div className="flex justify-between text-positive">
                <span>Less: Loss Carryover</span>
                <span className="font-mono">
                  -{formatCurrency(result.longTermLossCarryoverOffset)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t border-border pt-1 text-text-primary">
              <span>Net Long-Term Capital Gains</span>
              <span className="font-mono">{formatCurrency(netLTCG)}</span>
            </div>
          </div>

          {/* Bracket Breakdown Table - now from calculator result */}
          <BracketTable
            breakdown={result.ltcgBracketBreakdown}
            title="Long-Term Capital Gains Tax by Bracket"
            incomeLabel="Gains"
            totalLabel="Long-Term Capital Gains Tax:"
            totalAmount={result.totalTax}
          />
        </>
      ) : (
        <div className="bg-positive-bg p-3 rounded-[var(--radius-md)] mb-4">
          <p className="text-sm text-positive font-medium">
            No Washington tax due - no long-term capital gains reported.
          </p>
        </div>
      )}

      {/* Final Summary */}
      <TaxSummarySection
        totalTax={result.totalTax}
        withheld={result.withheld}
        estimatedPaid={result.estimatedPaid}
        remainingOwed={result.remainingOwed}
        refundDue={result.refundDue}
        taxLabel="Washington"
        showEffectiveRates={true}
        effectiveRates={calculateEffectiveRates(result)}
      />

      {/* Safe Harbor Section - Only show if tax is owed */}
      {result.safeHarbor && result.totalTax > 0 && result.remainingOwed > 0 && (
        <div className="bg-warning-bg p-3 rounded-[var(--radius-md)] space-y-2">
          <h3 className="font-medium text-text-primary">Safe Harbor (Penalty Avoidance)</h3>
          <p className="text-xs text-text-muted mb-2">
            Washington requires {formatPercent(limits.safeHarbor.percent)} of
            current year tax to avoid an underpayment penalty.
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-text-secondary">
              <span>
                {formatPercent(limits.safeHarbor.percent)} of Current Year Tax
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.safeHarbor.minimum)}
              </span>
            </div>
            <div className="flex justify-between text-positive">
              <span>Already Paid</span>
              <span className="font-mono">
                {formatCurrency(result.totalPaid)}
              </span>
            </div>
          </div>
          {result.safeHarbor.met ? (
            <div className="text-positive font-medium pt-2 border-t border-warning">
              Safe Harbor Met - no additional payment needed to avoid penalties
            </div>
          ) : (
            <div className="flex justify-between font-bold pt-2 border-t border-warning">
              <span className="text-text-primary">Still Needed for Safe Harbor</span>
              <span className="text-warning font-mono">
                {formatCurrency(result.safeHarbor.remaining)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
