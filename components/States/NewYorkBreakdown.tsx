import { TaxCalculationResult, NewYorkLimitsData } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { calculateEffectiveRates } from '@/lib/taxUtils';
import { TAX_YEAR } from '@/lib/config';
import BracketTable from '../shared/BracketTable';
import TaxSummarySection from '../shared/TaxSummarySection';
import allNewYorkLimits from '@/data/newyork-limits.json';

const limits = allNewYorkLimits[TAX_YEAR] as NewYorkLimitsData;

interface Props {
  result: TaxCalculationResult;
}

export default function NewYorkBreakdown({ result }: Props) {
  const hasNYCTax = (result.nycTax ?? 0) > 0;

  return (
    <div className="bg-white rounded-lg shadow p-4 text-gray-900">
      <h2 className="text-lg font-semibold border-b pb-2 mb-4">
        New York Tax Breakdown
      </h2>

      <div className="bg-blue-50 p-3 rounded mb-4">
        <p className="text-sm text-blue-800">
          New York taxes all capital gains as ordinary income.
          {hasNYCTax && ' NYC local tax is added for city residents.'}
        </p>
      </div>

      {/* Income to Taxable Income Flow */}
      <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
        <div className="flex justify-between">
          <span>New York Income</span>
          <span className="font-mono">{formatCurrency(result.wageIncome)}</span>
        </div>
        {result.selfEmploymentIncome && (
          <div className="flex justify-between">
            <span>Self-Employment Income</span>
            <span className="font-mono">{formatCurrency(result.selfEmploymentIncome)}</span>
          </div>
        )}
        {result.shortTermCapitalGains > 0 && (
          <div className="flex justify-between">
            <span>Short-Term Capital Gains</span>
            <span className="font-mono">{formatCurrency(result.shortTermCapitalGains)}</span>
          </div>
        )}
        {result.longTermCapitalGains > 0 && (
          <div className="flex justify-between">
            <span>Long-Term Capital Gains</span>
            <span className="font-mono">{formatCurrency(result.longTermCapitalGains)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium border-t pt-1">
          <span>Gross Income</span>
          <span className="font-mono">{formatCurrency(result.grossIncome)}</span>
        </div>
        {result.shortTermLossCarryoverOffset > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Less: Short-Term Carryover Offset</span>
            <span className="font-mono">
              -{formatCurrency(result.shortTermLossCarryoverOffset)}
            </span>
          </div>
        )}
        {result.longTermLossCarryoverOffset > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Less: Long-Term Carryover Offset</span>
            <span className="font-mono">
              -{formatCurrency(result.longTermLossCarryoverOffset)}
            </span>
          </div>
        )}
        {result.contributions401k > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Less: 401(k) Contributions</span>
            <span className="font-mono">
              -{formatCurrency(result.contributions401k)}
            </span>
          </div>
        )}
        {result.preTaxMedical > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Less: Pre-Tax Medical</span>
            <span className="font-mono">
              -{formatCurrency(result.preTaxMedical)}
            </span>
          </div>
        )}
        {result.deductibleSETax && (
          <div className="flex justify-between text-green-700">
            <span>Less: Deductible SE Tax (50%)</span>
            <span className="font-mono">
              -{formatCurrency(result.deductibleSETax)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-green-700">
          <span>
            Less: {result.deductionBreakdown.deductionUsed === 'standard' ? 'Standard' : 'Itemized'} Deduction
          </span>
          <span className="font-mono">
            -{formatCurrency(result.deductionBreakdown.deductionAmount)}
          </span>
        </div>
        <div className="flex justify-between font-medium border-t pt-1">
          <span>New York Adjusted Gross Income (AGI)</span>
          <span className="font-mono">
            {formatCurrency(result.taxableOrdinaryIncome)}
          </span>
        </div>
      </div>

      {/* NY State Bracket Breakdown */}
      <BracketTable
        breakdown={result.ordinaryIncomeBracketBreakdown}
        title="NY State Tax by Bracket"
        incomeLabel="Income"
        totalLabel="NY State Tax:"
        totalAmount={result.ordinaryIncomeTax}
      />

      {/* NYC Local Tax Section */}
      {hasNYCTax && result.nycBracketBreakdown && (
        <BracketTable
          breakdown={result.nycBracketBreakdown}
          title="NYC Local Tax by Bracket"
          incomeLabel="Income"
          totalLabel="NYC Local Tax:"
          totalAmount={result.nycTax ?? 0}
        />
      )}

      {/* Combined Tax Summary */}
      {hasNYCTax && (
        <div className="bg-purple-50 p-3 rounded mb-4">
          <div className="flex justify-between text-sm">
            <span>NY State Tax</span>
            <span className="font-mono">{formatCurrency(result.ordinaryIncomeTax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>NYC Local Tax</span>
            <span className="font-mono">{formatCurrency(result.nycTax ?? 0)}</span>
          </div>
          <div className="flex justify-between font-medium pt-1 border-t border-purple-200">
            <span>Combined NY + NYC Tax</span>
            <span className="font-mono">{formatCurrency(result.totalTax)}</span>
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
        taxLabel="New York"
        showEffectiveRates={true}
        effectiveRates={calculateEffectiveRates(result)}
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
                <span>{formatPercent(result.safeHarbor.isHighIncome ? limits.safeHarbor.highIncomePercent : limits.safeHarbor.priorYearPercent)} of Prior Year Tax</span>
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
