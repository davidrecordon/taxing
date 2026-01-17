import { memo } from "react";
import { TaxCalculationResult, FederalLimitsData, FicaData } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { calculateEffectiveRates } from "@/lib/taxUtils";
import { TAX_YEAR } from "@/lib/config";
import BracketTable from "../shared/BracketTable";
import TaxSummarySection from "../shared/TaxSummarySection";
import allFederalLimits from "@/data/federal-limits.json";
import allFicaData from "@/data/fica.json";

const federalLimits = allFederalLimits[TAX_YEAR] as FederalLimitsData;
const ficaData = allFicaData[TAX_YEAR] as FicaData;

interface Props {
  result: TaxCalculationResult;
}

export default memo(function FederalBreakdown({ result }: Props) {
  return (
    <div className="theme-card p-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 mb-4 font-display">
        Federal Tax Breakdown
      </h2>

      {/* Income to Taxable Income Flow */}
      <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4 space-y-2">
        <div className="flex justify-between text-text-primary">
          <span>Wages & Other Income</span>
          <span className="font-mono">{formatCurrency(result.wageIncome)}</span>
        </div>
        {result.selfEmploymentTaxBreakdown && (
          <div className="flex justify-between text-text-primary">
            <span>Self-Employment Income</span>
            <span className="font-mono">
              {formatCurrency(
                Math.round(
                  result.selfEmploymentTaxBreakdown.netEarnings / 0.9235,
                ),
              )}
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
          <>
            <div className="flex justify-between text-positive">
              <span>Less: Short-Term Carryover Offset</span>
              <span className="font-mono">
                -{formatCurrency(result.shortTermLossCarryoverOffset)}
              </span>
            </div>
            {(result.shortTermLossCarryoverUnused ?? 0) > 0 && (
              <p className="text-xs text-text-muted ml-4">
                (Preserving{" "}
                {formatCurrency(result.shortTermLossCarryoverUnused!)} in ST
                carryover)
              </p>
            )}
          </>
        )}
        {result.longTermLossCarryoverOffset > 0 && (
          <>
            <div className="flex justify-between text-positive">
              <span>Less: Long-Term Carryover Offset</span>
              <span className="font-mono">
                -{formatCurrency(result.longTermLossCarryoverOffset)}
              </span>
            </div>
            {(result.longTermLossCarryoverUnused ?? 0) > 0 && (
              <p className="text-xs text-text-muted ml-4">
                (Preserving{" "}
                {formatCurrency(result.longTermLossCarryoverUnused!)} in LT
                carryover)
              </p>
            )}
          </>
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
        {result.selfEmploymentTaxBreakdown && (
          <div className="flex justify-between text-positive">
            <span>Less: Deductible SE Tax (50%)</span>
            <span className="font-mono">
              -
              {formatCurrency(result.selfEmploymentTaxBreakdown.deductibleHalf)}
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
        {result.qbiDeduction && result.qbiDeduction.finalDeduction > 0 && (
          <div className="flex justify-between text-positive">
            <span>
              Less: QBI Deduction (
              {formatPercent(federalLimits.qbiDeduction.rate)})
            </span>
            <span className="font-mono">
              -{formatCurrency(result.qbiDeduction.finalDeduction)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-medium border-t border-border pt-1 text-text-primary">
          <span>Adjusted Gross Income (AGI)</span>
          <span className="font-mono">
            {formatCurrency(Math.max(0, result.adjustedGrossIncome))}
          </span>
        </div>
      </div>

      {/* Deduction Details (if itemized) */}
      {result.deductionBreakdown.deductionUsed === "itemized" && (
        <div className="text-sm text-text-secondary mb-4 pl-2 border-l-2 border-border">
          <p className="font-medium text-text-primary mb-1">
            Itemized Deduction Breakdown:
          </p>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>
                SALT{result.deductionBreakdown.saltCapped && " (capped)"}
              </span>
              <span>
                {formatCurrency(result.deductionBreakdown.saltDeduction)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Mortgage Interest</span>
              <span>
                {formatCurrency(result.deductionBreakdown.mortgageInterest)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Charitable Contributions</span>
              <span>
                {formatCurrency(
                  result.deductionBreakdown.charitableContributions,
                )}
              </span>
            </div>
          </div>
          <p className="text-xs mt-1 text-text-muted">
            (Standard deduction would be{" "}
            {formatCurrency(result.deductionBreakdown.standardDeduction)}).
          </p>
        </div>
      )}
      {result.deductionBreakdown.deductionUsed === "standard" &&
        result.deductionBreakdown.itemizedDeduction > 0 && (
          <p className="text-sm text-text-secondary mb-4">
            Using standard deduction (
            {formatCurrency(result.deductionBreakdown.standardDeduction)}) —
            itemized would only be{" "}
            {formatCurrency(result.deductionBreakdown.itemizedDeduction)}.
          </p>
        )}

      {/* Bracket Breakdown - Ordinary Income */}
      <BracketTable
        breakdown={result.ordinaryIncomeBracketBreakdown}
        title="Ordinary Income Tax by Bracket"
        incomeLabel="Income"
        totalLabel="Ordinary Income Tax:"
        totalAmount={result.ordinaryIncomeTax}
      />

      {/* Bracket Breakdown - LTCG */}
      <BracketTable
        breakdown={result.ltcgBracketBreakdown}
        title="Long-Term Capital Gains Tax by Bracket"
        incomeLabel="Gains"
        totalLabel="Long-Term Capital Gains Tax:"
        totalAmount={result.ltcgTax}
      />

      {/* FICA Taxes */}
      {result.ficaBreakdown && result.ficaBreakdown.totalFica > 0 && (
        <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4">
          <h3 className="font-medium text-text-primary mb-2">
            FICA Taxes (Social Security & Medicare)
          </h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-text-secondary">
              <span>
                Social Security ({formatPercent(ficaData.socialSecurity.rate)}
                {result.wageIncome > result.ficaBreakdown.socialSecurityWages &&
                  ` on first ${formatCurrency(result.ficaBreakdown.socialSecurityWages)}`}
                )
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.ficaBreakdown.socialSecurityTax)}
              </span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>
                Medicare ({formatPercent(ficaData.medicareBase.rate)})
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.ficaBreakdown.medicareTax)}
              </span>
            </div>
            {result.ficaBreakdown.additionalMedicareTax > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>
                  Additional Medicare (
                  {formatPercent(ficaData.medicareAdditional.rate)})
                </span>
                <span className="font-mono text-text-primary">
                  {formatCurrency(result.ficaBreakdown.additionalMedicareTax)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-border text-text-primary">
              <span>Total FICA</span>
              <span className="font-mono">
                {formatCurrency(result.ficaBreakdown.totalFica)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* NIIT (Net Investment Income Tax) */}
      {result.niitBreakdown && (
        <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4">
          <h3 className="font-medium text-text-primary mb-2">Net Investment Income Tax (NIIT)</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-text-secondary">
              <span>Net Investment Income</span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.niitBreakdown.netInvestmentIncome)}
              </span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>MAGI Over Threshold</span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.niitBreakdown.magiOverThreshold)}
              </span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Taxable Amount (lesser)</span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.niitBreakdown.taxableAmount)}
              </span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t border-border text-text-primary">
              <span>NIIT ({formatPercent(federalLimits.niit.rate)})</span>
              <span className="font-mono">
                {formatCurrency(result.niitBreakdown.tax)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Self-Employment Tax */}
      {result.selfEmploymentTaxBreakdown && (
        <div className="bg-warning-bg p-3 rounded-[var(--radius-md)] mb-4">
          <h3 className="font-medium text-text-primary mb-2">Self-Employment Tax</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-text-secondary">
              <span>
                Social Security (
                {formatPercent(ficaData.selfEmployment.socialSecurityRate)})
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(
                  result.selfEmploymentTaxBreakdown.socialSecurityTax,
                )}
              </span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>
                Medicare ({formatPercent(ficaData.selfEmployment.medicareRate)})
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.selfEmploymentTaxBreakdown.medicareTax)}
              </span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t border-warning text-text-primary">
              <span>Total SE Tax</span>
              <span className="font-mono">
                {formatCurrency(result.selfEmploymentTaxBreakdown.totalSETax)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Final Summary */}
      <TaxSummarySection
        totalTax={result.totalTax}
        withheld={result.withheld}
        estimatedPaid={result.estimatedPaid}
        remainingOwed={result.remainingOwed}
        refundDue={result.refundDue}
        taxLabel="Federal"
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
                {formatPercent(federalLimits.safeHarbor.currentYearPercent)} of
                Current Year Tax
              </span>
              <span className="font-mono text-text-primary">
                {formatCurrency(result.safeHarbor.currentYear90Percent)}
              </span>
            </div>
            {result.safeHarbor.priorYearSafeHarbor > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>
                  {formatPercent(federalLimits.safeHarbor.priorYearPercent)} of
                  Prior Year Tax
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
