import { CalculationResults, STATE_LABELS } from '@/lib/types';
import FederalBreakdown from './FederalBreakdown';
import CaliforniaBreakdown from './States/CaliforniaBreakdown';
import WashingtonBreakdown from './States/WashingtonBreakdown';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  results: CalculationResults;
}

export default function TaxResultsDisplay({ results }: Props) {
  const stateLabel = STATE_LABELS[results.selectedState] || 'State';

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
            results.state.remainingOwed > 0
              ? 'bg-red-50 border border-red-200'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <h3 className="text-sm font-medium text-gray-900">{stateLabel}</h3>
          {results.state.remainingOwed > 0 ? (
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(results.state.remainingOwed)} owed
            </p>
          ) : (
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(results.state.refundDue)} refund
            </p>
          )}
        </div>
      </div>

      {/* Detailed Breakdowns */}
      <FederalBreakdown result={results.federal} />

      {results.selectedState === 'california' ? (
        <CaliforniaBreakdown result={results.state} />
      ) : (
        <WashingtonBreakdown result={results.state} />
      )}
    </div>
  );
}
