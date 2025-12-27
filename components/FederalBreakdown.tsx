import { TaxCalculationResult } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';

interface Props {
  result: TaxCalculationResult;
}

export default function FederalBreakdown({ result }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 text-gray-900">
      <h2 className="text-lg font-semibold border-b pb-2 mb-4">
        Federal Tax Breakdown
      </h2>

      {/* Income to Taxable Income Flow */}
      <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
        <div className="flex justify-between">
          <span>Federal Income</span>
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
          <span>Adjusted Gross Income (AGI)</span>
          <span className="font-mono">
            {formatCurrency(result.adjustedGrossIncome)}
          </span>
        </div>
      </div>

      {/* Deduction Details (if itemized) */}
      {result.deductionBreakdown.deductionUsed === 'itemized' && (
        <div className="text-sm text-gray-600 mb-4 pl-2 border-l-2 border-gray-300">
          <p className="font-medium text-gray-700 mb-1">Itemized Deduction Breakdown:</p>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>SALT{result.deductionBreakdown.saltCapped && ' (capped at $10k)'}</span>
              <span>{formatCurrency(result.deductionBreakdown.saltDeduction)}</span>
            </div>
            <div className="flex justify-between">
              <span>Mortgage Interest</span>
              <span>{formatCurrency(result.deductionBreakdown.mortgageInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span>Charitable Contributions</span>
              <span>{formatCurrency(result.deductionBreakdown.charitableContributions)}</span>
            </div>
          </div>
          <p className="text-xs mt-1">
            (Standard deduction would be {formatCurrency(result.deductionBreakdown.standardDeduction)}).
          </p>
        </div>
      )}
      {result.deductionBreakdown.deductionUsed === 'standard' &&
       result.deductionBreakdown.itemizedDeduction > 0 && (
        <p className="text-sm text-gray-600 mb-4">
          Using standard deduction ({formatCurrency(result.deductionBreakdown.standardDeduction)})
          — itemized would only be {formatCurrency(result.deductionBreakdown.itemizedDeduction)}.
        </p>
      )}

      {/* Bracket Breakdown - Ordinary Income */}
      {result.ordinaryIncomeBracketBreakdown.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Ordinary Income Tax by Bracket</h3>
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
                {result.ordinaryIncomeBracketBreakdown.map((bracket, i) => (
                  <tr key={i} className="border-b">
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
                  <td colSpan={3} className="p-2 text-right">
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

      {/* Bracket Breakdown - LTCG */}
      {result.ltcgBracketBreakdown.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Long-Term Capital Gains Tax by Bracket</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Bracket</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Gains</th>
                  <th className="text-right p-2">Tax</th>
                </tr>
              </thead>
              <tbody>
                {result.ltcgBracketBreakdown.map((bracket, i) => (
                  <tr key={i} className="border-b">
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
                  <td colSpan={3} className="p-2 text-right">
                    Long-Term Capital Gains Tax:
                  </td>
                  <td className="p-2 text-right font-mono">
                    {formatCurrency(result.ltcgTax)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* FICA Taxes */}
      {result.ficaBreakdown && (
        <div className="bg-purple-50 p-3 rounded mb-4">
          <h3 className="font-medium mb-2">FICA Taxes (Social Security & Medicare)</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Social Security (6.2% on first {formatCurrency(result.ficaBreakdown.socialSecurityWages)})</span>
              <span className="font-mono">{formatCurrency(result.ficaBreakdown.socialSecurityTax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Medicare (1.45%)</span>
              <span className="font-mono">{formatCurrency(result.ficaBreakdown.medicareTax)}</span>
            </div>
            {result.ficaBreakdown.additionalMedicareTax > 0 && (
              <div className="flex justify-between">
                <span>Additional Medicare (0.9%)</span>
                <span className="font-mono">{formatCurrency(result.ficaBreakdown.additionalMedicareTax)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-purple-200">
              <span>Total FICA</span>
              <span className="font-mono">{formatCurrency(result.ficaBreakdown.totalFica)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Final Summary */}
      <div className="bg-blue-50 p-3 rounded mb-4 space-y-2">
        <div className="flex justify-between font-medium">
          <span>Total Federal Tax</span>
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
            {result.safeHarbor.priorYear110Percent > 0 && (
              <div className="flex justify-between">
                <span>110% of Prior Year Tax</span>
                <span className="font-mono">{formatCurrency(result.safeHarbor.priorYear110Percent)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Safe Harbor Minimum{result.safeHarbor.priorYear110Percent > 0 ? ' (lesser)' : ''}</span>
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
