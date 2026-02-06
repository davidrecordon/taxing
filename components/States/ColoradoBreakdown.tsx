import { memo, useMemo } from "react";
import { TaxCalculationResult, ColoradoLimitsData } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { TaxYear } from "@/lib/config";
import BracketTable from "../shared/BracketTable";
import TaxSummarySection from "../shared/TaxSummarySection";
import allColoradoLimits from "@/data/colorado-limits.json";

interface Props {
  result: TaxCalculationResult;
  taxYear: TaxYear;
}

export default memo(function ColoradoBreakdown({ result, taxYear }: Props) {
  const limits = useMemo(
    () => allColoradoLimits[taxYear] as ColoradoLimitsData,
    [taxYear],
  );

  return (
    <div className="theme-card p-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 mb-4 font-display">
        Colorado Tax Breakdown
      </h2>

      {/* Federal Taxable Income as Starting Point */}
      <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4 space-y-2">
        <div className="flex justify-between font-medium text-text-primary">
          <span>Federal Taxable Income</span>
          <span className="font-mono">
            {formatCurrency(result.taxableOrdinaryIncome)}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          Colorado uses your federal taxable income (after federal deductions)
          as the starting point for state taxes.
        </p>
      </div>

      {/* Bracket Breakdown - will show single row for flat rate */}
      <BracketTable
        breakdown={result.ordinaryIncomeBracketBreakdown}
        title="Tax Calculation"
        incomeLabel="Income"
        totalLabel="Colorado Income Tax:"
        totalAmount={result.ordinaryIncomeTax}
      />

      {/* Final Summary */}
      <TaxSummarySection
        totalTax={result.totalTax}
        withheld={result.withheld}
        estimatedPaid={result.estimatedPaid}
        remainingOwed={result.remainingOwed}
        refundDue={result.refundDue}
        taxLabel="Colorado"
      />

      {/* Safe Harbor Section */}
      {result.safeHarbor && result.remainingOwed > 0 && (
        <div className="bg-warning-bg p-3 rounded-[var(--radius-md)] space-y-2">
          <h3 className="font-medium text-text-primary">Safe Harbor (Penalty Avoidance)</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-text-secondary">
              <span>
                {formatPercent(limits.safeHarbor.currentYearPercent)} of Current
                Year Tax
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.safeHarbor.currentYear90Percent)}
              </span>
            </div>
            {result.safeHarbor.priorYearSafeHarbor > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>
                  {formatPercent(limits.safeHarbor.priorYearPercent)} of Prior
                  Year Tax
                </span>
                <span className="font-mono text-text-primary">
                  {formatCurrency(result.safeHarbor.priorYearSafeHarbor)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-warning text-text-primary">
              <span>
                Safe Harbor Minimum
                {result.safeHarbor.priorYearSafeHarbor > 0 ? " (lesser)" : ""}
              </span>
              <span className="font-mono">
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
