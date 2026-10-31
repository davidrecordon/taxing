import { memo, useMemo } from "react";
import { TaxCalculationResult, FederalLimitsData, FicaData } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { calculateEffectiveRates } from "@/lib/taxUtils";
import { TaxYear } from "@/lib/config";
import BracketTable from "../shared/BracketTable";
import InvestmentIncomeRows from "../shared/InvestmentIncomeRows";
import ItemizedDeductionDetails from "../shared/ItemizedDeductionDetails";
import TaxSummarySection from "../shared/TaxSummarySection";
import allFederalLimits from "@/data/federal-limits.json";
import allFicaData from "@/data/fica.json";

interface Props {
  result: TaxCalculationResult;
  taxYear: TaxYear;
}

export default memo(function FederalBreakdown({ result, taxYear }: Props) {
  const federalLimits = useMemo(
    () => allFederalLimits[taxYear] as FederalLimitsData,
    [taxYear],
  );
  const ficaData = useMemo(
    () => allFicaData[taxYear] as FicaData,
    [taxYear],
  );

  const hasQualifiedDividends = (result.qualifiedDividends ?? 0) > 0;
  const fica = result.ficaBreakdown;
  // The surtax matters once it is owed or withheld: a one-earner couple can
  // have it withheld below the joint threshold
  const hasAdditionalMedicare =
    fica !== undefined &&
    (fica.additionalMedicareTax > 0 || fica.additionalMedicareWithheld > 0);
  const additionalMedicareDiffers =
    hasAdditionalMedicare &&
    Math.round(fica.additionalMedicareTax * 100) !==
      Math.round(fica.additionalMedicareWithheld * 100);

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
        <InvestmentIncomeRows result={result} />
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
              <span>Less: Short-Term Loss Offset</span>
              <span className="font-mono">
                -{formatCurrency(result.shortTermLossCarryoverOffset)}
              </span>
            </div>
            {(result.shortTermLossCarryoverUnused ?? 0) > 0 && (
              <p className="text-xs text-text-muted ml-4">
                ({formatCurrency(result.shortTermLossCarryoverUnused!)} ST loss
                carries over to next year)
              </p>
            )}
          </>
        )}
        {result.longTermLossCarryoverOffset > 0 && (
          <>
            <div className="flex justify-between text-positive">
              <span>Less: Long-Term Loss Offset</span>
              <span className="font-mono">
                -{formatCurrency(result.longTermLossCarryoverOffset)}
              </span>
            </div>
            {(result.longTermLossCarryoverUnused ?? 0) > 0 && (
              <p className="text-xs text-text-muted ml-4">
                ({formatCurrency(result.longTermLossCarryoverUnused!)} LT loss
                carries over to next year)
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
        <div className="flex justify-between font-medium border-t border-border pt-1 text-text-primary">
          <span>Adjusted Gross Income (AGI)</span>
          <span className="font-mono">
            {formatCurrency(Math.max(0, result.adjustedGrossIncome))}
          </span>
        </div>
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
          <span>Taxable Income</span>
          <span className="font-mono">
            {formatCurrency(result.taxableOrdinaryIncome + result.taxableLTCG)}
          </span>
        </div>
      </div>

      {/* Deduction Details (if itemized) */}
      <ItemizedDeductionDetails
        deductionBreakdown={result.deductionBreakdown}
      />
      {result.deductionBreakdown.deductionUsed === "standard" &&
        result.deductionBreakdown.itemizedDeduction > 0 &&
        (result.deductionBreakdown.chosenForStateTax ? (
          <p className="text-sm text-text-secondary mb-4">
            Using standard deduction (
            {formatCurrency(result.deductionBreakdown.standardDeduction)})
            although itemized would be{" "}
            {formatCurrency(result.deductionBreakdown.itemizedDeduction)}: this
            lowers your Federal and state tax combined.
          </p>
        ) : (
          <p className="text-sm text-text-secondary mb-4">
            Using standard deduction (
            {formatCurrency(result.deductionBreakdown.standardDeduction)}) —
            itemized would only be{" "}
            {formatCurrency(result.deductionBreakdown.itemizedDeduction)}.
          </p>
        ))}

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
        title={
          hasQualifiedDividends
            ? "Long-Term Capital Gains & Qualified Dividends Tax by Bracket"
            : "Long-Term Capital Gains Tax by Bracket"
        }
        incomeLabel={hasQualifiedDividends ? "Income" : "Gains"}
        totalLabel={
          hasQualifiedDividends
            ? "Long-Term Gains & Qualified Dividends Tax:"
            : "Long-Term Capital Gains Tax:"
        }
        totalAmount={result.ltcgTax}
      />

      {/* Payroll taxes */}
      {result.ficaBreakdown && result.ficaBreakdown.totalFica > 0 && (
        <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4">
          <h3 className="font-medium text-text-primary">
            Payroll Taxes (Social Security & Medicare)
          </h3>
          <p className="text-xs text-text-muted mb-2">
            Social Security and Medicare are withheld by your employer and not
            included in the Federal tax total below.
            {hasAdditionalMedicare &&
              " Additional Medicare is included in it, and what employers withhold toward it counts as a payment."}
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-text-secondary">
              <span>
                Social Security ({formatPercent(ficaData.socialSecurity.rate)}
                {result.wageIncome > result.ficaBreakdown.socialSecurityWages &&
                  ` on first ${formatCurrency(ficaData.socialSecurity.wageBaseCap)}`}
                {result.ficaBreakdown.socialSecurityWages >
                  ficaData.socialSecurity.wageBaseCap &&
                  " of each earner's wages"}
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
            {hasAdditionalMedicare && (
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
            {additionalMedicareDiffers && (
              <p className="text-xs text-text-muted ml-4">
                Employers withhold{" "}
                {formatCurrency(result.ficaBreakdown.additionalMedicareWithheld)}{" "}
                toward it: the surtax is withheld above{" "}
                {formatCurrency(
                  ficaData.medicareAdditional.withholdingThreshold,
                )}{" "}
                of each earner&apos;s wages, whatever the filing status.
              </p>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-border text-text-primary">
              <span>Total Payroll Tax</span>
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
            {result.selfEmploymentTaxBreakdown.additionalMedicareTax > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>
                  Additional Medicare (
                  {formatPercent(ficaData.medicareAdditional.rate)})
                </span>
                <span className="font-mono text-text-primary">
                  {formatCurrency(
                    result.selfEmploymentTaxBreakdown.additionalMedicareTax,
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-warning text-text-primary">
              <span>Total SE Tax</span>
              <span className="font-mono">
                {formatCurrency(
                  result.selfEmploymentTaxBreakdown.totalSETax +
                    result.selfEmploymentTaxBreakdown.additionalMedicareTax,
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tax credits */}
      {result.taxCredits !== undefined && result.taxCredits > 0 && (
        <div className="bg-secondary p-3 rounded-[var(--radius-md)] mb-4">
          <div className="flex justify-between text-positive">
            <span>Less: Tax Credits</span>
            <span className="font-mono">-{formatCurrency(result.taxCredits)}</span>
          </div>
          <p className="text-xs text-text-muted">
            Taken off income tax only, not self-employment tax, NIIT or
            Additional Medicare.
          </p>
        </div>
      )}

      {/* Final Summary */}
      <TaxSummarySection
        totalTax={result.totalTax}
        withheld={result.withheld}
        withheldEstimated={result.withheldEstimated}
        additionalMedicareWithheld={result.additionalMedicareWithheld}
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
                  {formatPercent(
                    result.safeHarbor.priorYearPercent ??
                      federalLimits.safeHarbor.priorYearPercent,
                  )} of
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
