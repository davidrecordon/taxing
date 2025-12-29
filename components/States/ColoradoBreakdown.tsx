import { TaxCalculationResult, ColoradoLimitsData } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { calculateEffectiveRates } from '@/lib/taxUtils';
import { TAX_YEAR } from '@/lib/config';
import BracketTable from '../shared/BracketTable';
import TaxSummarySection from '../shared/TaxSummarySection';
import allColoradoLimits from '@/data/colorado-limits.json';

const limits = allColoradoLimits[TAX_YEAR] as ColoradoLimitsData;

interface Props {
  result: TaxCalculationResult;
}

export default function ColoradoBreakdown({ result }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 text-gray-900">
      <h2 className="text-lg font-semibold border-b pb-2 mb-4">
        Colorado Tax Breakdown
      </h2>

      {/* Federal Taxable Income as Starting Point */}
      <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
        <div className="flex justify-between font-medium">
          <span>Federal Taxable Income</span>
          <span className="font-mono">{formatCurrency(result.taxableOrdinaryIncome)}</span>
        </div>
        <p className="text-xs text-gray-600">
          Colorado uses your federal taxable income (after federal deductions) as the starting point for state taxes.
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
        <div className="bg-amber-50 p-3 rounded space-y-2">
          <h3 className="font-medium">Safe Harbor (Penalty Avoidance)</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>{formatPercent(limits.safeHarbor.currentYearPercent)} of Current Year Tax</span>
              <span className="font-mono">{formatCurrency(result.safeHarbor.currentYear90Percent)}</span>
            </div>
            {result.safeHarbor.priorYearSafeHarbor > 0 && (
              <div className="flex justify-between">
                <span>{formatPercent(limits.safeHarbor.priorYearPercent)} of Prior Year Tax</span>
                <span className="font-mono">{formatCurrency(result.safeHarbor.priorYearSafeHarbor)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Safe Harbor Minimum{result.safeHarbor.priorYearSafeHarbor > 0 ? ' (lesser)' : ''}</span>
              <span className="font-mono">{formatCurrency(result.safeHarbor.minimum)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Already Paid</span>
              <span className="font-mono">{formatCurrency(result.totalPaid)}</span>
            </div>
          </div>
          {result.safeHarbor.met ? (
            <div className="text-green-700 font-medium pt-2 border-t border-amber-200">
              Safe Harbor Met - no additional payment needed to avoid penalties
            </div>
          ) : (
            <div className="flex justify-between font-bold pt-2 border-t border-amber-200">
              <span>Still Needed for Safe Harbor</span>
              <span className="text-amber-700 font-mono">
                {formatCurrency(result.safeHarbor.remaining)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
