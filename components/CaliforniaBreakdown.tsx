import { TaxCalculationResult } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { calculateEffectiveRates } from '@/lib/taxUtils';

interface Props {
  result: TaxCalculationResult;
}

export default function CaliforniaBreakdown({ result }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 text-gray-900">
      <h2 className="text-lg font-semibold border-b pb-2 mb-4">
        California Tax Breakdown
      </h2>

      {/* Income to Taxable Income Flow */}
      <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
        <div className="flex justify-between">
          <span>California Income</span>
          <span className="font-mono">{formatCurrency(result.wageIncome)}</span>
        </div>
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
        <div className="flex justify-between text-green-700">
          <span>
            Less: {result.deductionBreakdown.deductionUsed === 'standard' ? 'Standard' : 'Itemized'} Deduction
          </span>
          <span className="font-mono">
            -{formatCurrency(result.deductionBreakdown.deductionAmount)}
          </span>
        </div>
        <div className="flex justify-between font-medium border-t pt-1">
          <span>California Adjusted Gross Income (AGI)</span>
          <span className="font-mono">
            {formatCurrency(result.taxableOrdinaryIncome)}
          </span>
        </div>
      </div>

      {/* Bracket Breakdown */}
      {result.ordinaryIncomeBracketBreakdown.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Tax by Bracket</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Bracket</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Income</th>
                  <th className="text-right p-2">Tax</th>
                </tr>
              </thead>
              <tbody>
                {result.ordinaryIncomeBracketBreakdown.map((bracket) => (
                  <tr key={`${bracket.bracketMin}-${bracket.rate}`} className="border-b">
                    <td className="p-2">
                      {formatCurrency(bracket.bracketMin)} -{' '}
                      {bracket.bracketMax
                        ? formatCurrency(bracket.bracketMax)
                        : '...'}
                    </td>
                    <td className="text-right p-2">{formatPercent(bracket.rate)}</td>
                    <td className="text-right p-2 font-mono">
                      {formatCurrency(bracket.incomeInBracket)}
                    </td>
                    <td className="text-right p-2 font-mono">
                      {formatCurrency(bracket.taxForBracket)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-medium bg-gray-50">
                <tr>
                  <td>
                    <p className="text-xs text-gray-500">
                      California taxes all capital gains as ordinary income.
                    </p>
                  </td>
                  <td colSpan={2} className="p-2 text-right">
                    Ordinary Income Tax:
                  </td>
                  <td className="p-2 text-right font-mono">
                    {formatCurrency(result.ordinaryIncomeTax)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Mental Health Services Tax */}
      {(result.caMentalHealthTax ?? 0) > 0 && (
        <div className="bg-purple-50 p-3 rounded mb-4">
          <div className="flex justify-between font-medium">
            <span>Mental Health Services Tax (1% over $1M)</span>
            <span className="font-mono">{formatCurrency(result.caMentalHealthTax ?? 0)}</span>
          </div>
        </div>
      )}

      {/* Final Summary */}
      <div className="bg-blue-50 p-3 rounded mb-4 space-y-2">
        <div className="flex justify-between font-medium">
          <span>Total California Tax</span>
          <span className="font-mono">{formatCurrency(result.totalTax)}</span>
        </div>
        <div className="flex justify-between text-sm text-green-600">
          <span>Less: Withheld</span>
          <span className="font-mono">-{formatCurrency(result.withheld)}</span>
        </div>
        <div className="flex justify-between text-sm text-green-600">
          <span>Less: Estimated Paid</span>
          <span className="font-mono">-{formatCurrency(result.estimatedPaid)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-blue-200">
          {result.remainingOwed > 0 ? (
            <>
              <span>Estimated Tax Still Owed</span>
              <span className="text-red-600 font-mono">
                {formatCurrency(result.remainingOwed)}
              </span>
            </>
          ) : (
            <>
              <span>Estimated Refund</span>
              <span className="text-green-600 font-mono">
                {formatCurrency(result.refundDue)}
              </span>
            </>
          )}
        </div>
        {(() => {
          const rates = calculateEffectiveRates(result);
          return (
            <div className="pt-2 mt-2 border-t border-blue-200 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Effective Rate (on taxable income)</span>
                <span className="font-mono">{formatPercent(rates.onTaxableIncome)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Effective Rate (on gross income)</span>
                <span className="font-mono">{formatPercent(rates.onGrossIncome)}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Safe Harbor Section */}
      {result.safeHarbor && result.remainingOwed > 0 && (
        <div className="bg-amber-50 p-3 rounded space-y-2">
          <h3 className="font-medium">Safe Harbor (Penalty Avoidance)</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>90% of Current Year Tax</span>
              <span className="font-mono">{formatCurrency(result.safeHarbor.currentYear90Percent)}</span>
            </div>
            {!result.safeHarbor.highIncomeException && result.safeHarbor.priorYearSafeHarbor > 0 && (
              <div className="flex justify-between">
                <span>100% of Prior Year Tax</span>
                <span className="font-mono">{formatCurrency(result.safeHarbor.priorYearSafeHarbor)}</span>
              </div>
            )}
            {result.safeHarbor.highIncomeException && (
              <p className="text-xs text-gray-600 italic">
                (100% prior year not available - CA AGI over $1M threshold)
              </p>
            )}
            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Safe Harbor Minimum{!result.safeHarbor.highIncomeException && result.safeHarbor.priorYearSafeHarbor > 0 ? ' (lesser)' : ''}</span>
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
