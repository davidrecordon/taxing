import { memo } from "react";
import { TaxCalculationResult } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface InvestmentIncomeRowsProps {
  result: Pick<TaxCalculationResult, "interestIncome" | "ordinaryDividends">;
}

/**
 * Interest and dividend rows for the income section of a breakdown.
 * Each row is shown only when its amount is positive.
 * Used by Federal, California, DC, Illinois, and New York breakdown components.
 */
export default memo(function InvestmentIncomeRows({
  result,
}: InvestmentIncomeRowsProps) {
  const { interestIncome = 0, ordinaryDividends = 0 } = result;

  return (
    <>
      {interestIncome > 0 && (
        <div className="flex justify-between text-text-primary">
          <span>Interest</span>
          <span className="font-mono">{formatCurrency(interestIncome)}</span>
        </div>
      )}
      {ordinaryDividends > 0 && (
        <div className="flex justify-between text-text-primary">
          <span>Dividends</span>
          <span className="font-mono">{formatCurrency(ordinaryDividends)}</span>
        </div>
      )}
    </>
  );
});
