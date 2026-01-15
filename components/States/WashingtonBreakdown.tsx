import { memo } from 'react';
import { TaxCalculationResult, WashingtonLimitsData } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { calculateEffectiveRates } from '@/lib/taxUtils';
import { TAX_YEAR } from '@/lib/config';
import BracketTable from '../shared/BracketTable';
import TaxSummarySection from '../shared/TaxSummarySection';
import allWashingtonLimits from '@/data/washington-limits.json';

const limits = allWashingtonLimits[TAX_YEAR] as WashingtonLimitsData;

interface Props {
  result: TaxCalculationResult;
}

export default memo(function WashingtonBreakdown({ result }: Props) {
  const hasLTCG = result.longTermCapitalGains > 0;

  // Calculate net LTCG for display
  const netLTCG = result.longTermCapitalGains - result.longTermLossCarryoverOffset;

  return (
    <div className="bg-white rounded-lg shadow p-4 text-gray-900">
      <h2 className="text-lg font-semibold border-b pb-2 mb-4">
        Washington Tax Breakdown
      </h2>

      {/* No Income Tax Notice */}
      <div className="bg-blue-50 p-3 rounded mb-4">
        <p className="text-sm text-blue-800">
          Washington has no income tax on wages or short-term capital gains.
        </p>
      </div>

      {hasLTCG ? (
        <>
          {/* Capital Gains Flow */}
          <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
            <div className="flex justify-between">
              <span>Long-Term Capital Gains</span>
              <span className="font-mono">{formatCurrency(result.longTermCapitalGains)}</span>
            </div>
            {result.longTermLossCarryoverOffset > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Less: Loss Carryover</span>
                <span className="font-mono">-{formatCurrency(result.longTermLossCarryoverOffset)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t pt-1">
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
        <div className="bg-green-50 p-3 rounded mb-4">
          <p className="text-sm text-green-800 font-medium">
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
        <div className="bg-amber-50 p-3 rounded space-y-2">
          <h3 className="font-medium">Safe Harbor (Penalty Avoidance)</h3>
          <p className="text-xs text-gray-600 mb-2">
            Washington requires {formatPercent(limits.safeHarbor.percent)} of current year tax to avoid an underpayment penalty.
          </p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>{formatPercent(limits.safeHarbor.percent)} of Current Year Tax</span>
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
})
