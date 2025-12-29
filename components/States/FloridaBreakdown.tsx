import { TaxCalculationResult } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import TaxSummarySection from '../shared/TaxSummarySection';

interface Props {
  result: TaxCalculationResult;
}

export default function FloridaBreakdown({ result }: Props) {
  const hasWithholding = result.withheld > 0 || result.estimatedPaid > 0;

  return (
    <div className="bg-white rounded-lg shadow p-4 text-gray-900">
      <h2 className="text-lg font-semibold border-b pb-2 mb-4">
        Florida Tax Breakdown
      </h2>

      {/* No Income Tax Notice */}
      <div className="bg-green-50 p-3 rounded mb-4">
        <p className="text-sm text-green-800 font-medium">
          Florida has no state income tax on wages, capital gains, or other personal income.
        </p>
      </div>

      {/* Payment Summary - only show if there's withholding to refund */}
      {hasWithholding ? (
        <TaxSummarySection
          totalTax={0}
          withheld={result.withheld}
          estimatedPaid={result.estimatedPaid}
          remainingOwed={0}
          refundDue={result.refundDue}
          taxLabel="Florida"
          showEffectiveRates={false}
        />
      ) : (
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex justify-between font-medium">
            <span>Florida Income Tax</span>
            <span className="font-mono text-green-600">{formatCurrency(0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
