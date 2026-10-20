import { memo } from "react";
import { DeductionBreakdown } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  deductionBreakdown: DeductionBreakdown;
}

/**
 * Itemized deduction components, shown when itemizing. Federal returns show
 * the capped SALT deduction; state returns show property tax instead.
 */
export default memo(function ItemizedDeductionDetails({
  deductionBreakdown,
}: Props) {
  if (deductionBreakdown.deductionUsed !== "itemized") return null;

  const highIncomeReduction = deductionBreakdown.highIncomeReduction ?? 0;

  return (
    <div className="text-sm text-text-secondary mb-4 pl-2 border-l-2 border-border">
      <p className="font-medium text-text-primary mb-1">
        Itemized Deduction Breakdown:
      </p>
      <div className="space-y-0.5">
        {deductionBreakdown.propertyTax === undefined ? (
          <div className="flex justify-between">
            <span>SALT{deductionBreakdown.saltCapped && " (capped)"}</span>
            <span>{formatCurrency(deductionBreakdown.saltDeduction)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span>Property Tax</span>
            <span>{formatCurrency(deductionBreakdown.propertyTax)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Mortgage Interest</span>
          <span>{formatCurrency(deductionBreakdown.mortgageInterest)}</span>
        </div>
        <div className="flex justify-between">
          <span>Charitable Contributions</span>
          <span>
            {formatCurrency(deductionBreakdown.charitableContributions)}
          </span>
        </div>
        {highIncomeReduction > 0 && (
          <div className="flex justify-between">
            <span>Less: High-Income Limitation</span>
            <span>-{formatCurrency(highIncomeReduction)}</span>
          </div>
        )}
      </div>
      <p className="text-xs mt-1 text-text-muted">
        {deductionBreakdown.followsFederalChoice
          ? "(Itemizing is required here because the Federal return itemizes.)"
          : `(Standard deduction would be ${formatCurrency(deductionBreakdown.standardDeduction)}).`}
      </p>
    </div>
  );
});
