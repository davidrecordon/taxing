import { memo } from "react";
import { TaxCalculationResult, DCLimitsData } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { calculateEffectiveRates } from "@/lib/taxUtils";
import { TAX_YEAR } from "@/lib/config";
import BracketTable from "../shared/BracketTable";
import TaxSummarySection from "../shared/TaxSummarySection";
import allDCLimits from "@/data/dc-limits.json";

const limits = allDCLimits[TAX_YEAR] as DCLimitsData;

interface Props {
  result: TaxCalculationResult;
}

export default memo(function DCBreakdown({ result }: Props) {
  return (
    <div className="theme-card p-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 mb-4 font-display">
        District of Columbia Tax Breakdown
      </h2>

      <div className="bg-accent-subtle p-3 rounded-[var(--radius-md)] mb-4">
        <p className="text-sm text-accent">
          DC taxes all capital gains as ordinary income.
        </p>
      </div>

      {/* Income to Taxable Income Flow */}
      <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4 space-y-2">
        <div className="flex justify-between text-text-primary">
          <span>DC Income</span>
          <span className="font-mono">{formatCurrency(result.wageIncome)}</span>
        </div>
        {result.selfEmploymentIncome && (
          <div className="flex justify-between text-text-primary">
            <span>Self-Employment Income</span>
            <span className="font-mono">
              {formatCurrency(result.selfEmploymentIncome)}
            </span>
          </div>
        )}
        {result.shortTermCapitalGains > 0 && (
          <div className="flex justify-between text-text-primary">
            <span>Short-Term Capital Gains</span>
            <span className="font-mono">
              {formatCurrency(result.shortTermCapitalGains)}
            </span>
          </div>
        )}
        {result.longTermCapitalGains > 0 && (
          <div className="flex justify-between text-text-primary">
            <span>Long-Term Capital Gains</span>
            <span className="font-mono">
              {formatCurrency(result.longTermCapitalGains)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-medium border-t border-border pt-1 text-text-primary">
          <span>Gross Income</span>
          <span className="font-mono">
            {formatCurrency(result.grossIncome)}
          </span>
        </div>
        {result.shortTermLossCarryoverOffset > 0 && (
          <div className="flex justify-between text-positive">
            <span>Less: Short-Term Carryover Offset</span>
            <span className="font-mono">
              -{formatCurrency(result.shortTermLossCarryoverOffset)}
            </span>
          </div>
        )}
        {result.longTermLossCarryoverOffset > 0 && (
          <div className="flex justify-between text-positive">
            <span>Less: Long-Term Carryover Offset</span>
            <span className="font-mono">
              -{formatCurrency(result.longTermLossCarryoverOffset)}
            </span>
          </div>
        )}
        {result.contributions401k > 0 && (
          <div className="flex justify-between text-positive">
            <span>Less: 401(k) Contributions</span>
            <span className="font-mono">
              -{formatCurrency(result.contributions401k)}
            </span>
          </div>
        )}
        {result.preTaxMedical > 0 && (
          <div className="flex justify-between text-positive">
            <span>Less: Pre-Tax Medical</span>
            <span className="font-mono">
              -{formatCurrency(result.preTaxMedical)}
            </span>
          </div>
        )}
        {result.deductibleSETax && (
          <div className="flex justify-between text-positive">
            <span>Less: Deductible SE Tax (50%)</span>
            <span className="font-mono">
              -{formatCurrency(result.deductibleSETax)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-positive">
          <span>
            Less:{" "}
            {result.deductionBreakdown.deductionUsed === "standard"
              ? "Standard"
              : "Itemized"}{" "}
            Deduction
          </span>
          <span className="font-mono">
            -{formatCurrency(result.deductionBreakdown.deductionAmount)}
          </span>
        </div>
        <div className="flex justify-between font-medium border-t border-border pt-1 text-text-primary">
          <span>DC Adjusted Gross Income (AGI)</span>
          <span className="font-mono">
            {formatCurrency(result.taxableOrdinaryIncome)}
          </span>
        </div>
      </div>

      {/* DC Tax Bracket Breakdown */}
      <BracketTable
        breakdown={result.ordinaryIncomeBracketBreakdown}
        title="DC Tax by Bracket"
        incomeLabel="Income"
        totalLabel="DC Tax:"
        totalAmount={result.ordinaryIncomeTax}
      />

      {/* Final Summary */}
      <TaxSummarySection
        totalTax={result.totalTax}
        withheld={result.withheld}
        estimatedPaid={result.estimatedPaid}
        remainingOwed={result.remainingOwed}
        refundDue={result.refundDue}
        taxLabel="DC"
        showEffectiveRates={true}
        effectiveRates={calculateEffectiveRates(result)}
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
