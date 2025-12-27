import { CalculationResults } from '@/lib/types';
import FederalBreakdown from './FederalBreakdown';
import CaliforniaBreakdown from './CaliforniaBreakdown';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  results: CalculationResults;
}

export default function TaxResultsDisplay({ results }: Props) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`p-4 rounded-lg ${
            results.federal.remainingOwed > 0
              ? 'bg-red-50 border border-red-200'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-900">Federal</h3>
          {results.federal.remainingOwed > 0 ? (
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(results.federal.remainingOwed)} owed
            </p>
          ) : (
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(results.federal.refundDue)} refund
            </p>
          )}
        </div>

        <div
          className={`p-4 rounded-lg ${
            results.california.remainingOwed > 0
              ? 'bg-red-50 border border-red-200'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-900">California</h3>
          {results.california.remainingOwed > 0 ? (
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(results.california.remainingOwed)} owed
            </p>
          ) : (
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(results.california.refundDue)} refund
            </p>
          )}
        </div>
      </div>

      {/* Detailed Breakdowns */}
      <FederalBreakdown result={results.federal} />
      <CaliforniaBreakdown result={results.california} />
    </div>
  );
}
