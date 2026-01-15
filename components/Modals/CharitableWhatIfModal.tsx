'use client';

import { useEffect } from 'react';
import { formatCurrency, formatPercent } from '@/lib/formatters';

interface ScenarioResult {
  totalTax: number;
  remainingOwed: number;
  effectiveRate: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentContributions: number;
  federalAgi: number;
  currentResults: ScenarioResult;
  calculateScenario: (contributions: number) => ScenarioResult;
  onApply: (contributions: number) => void;
}

export default function CharitableWhatIfModal({
  isOpen,
  onClose,
  currentContributions,
  federalAgi,
  currentResults,
  calculateScenario,
  onApply,
}: Props) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build scenarios based on current contributions
  const scenarios = currentContributions === 0
    ? [
        { label: 'Current ($0)', value: 0, isCurrent: true },
        { label: '1% of AGI', value: Math.round(federalAgi * 0.01), isCurrent: false },
        { label: '5% of AGI', value: Math.round(federalAgi * 0.05), isCurrent: false },
        { label: '10% of AGI', value: Math.round(federalAgi * 0.10), isCurrent: false },
      ]
    : [
        { label: 'Half', value: Math.round(currentContributions / 2), isCurrent: false },
        { label: 'Current', value: currentContributions, isCurrent: true },
        { label: 'Double', value: currentContributions * 2, isCurrent: false },
      ];

  // Calculate results for each scenario
  const scenarioResults = scenarios.map((scenario) => ({
    ...scenario,
    results: scenario.isCurrent ? currentResults : calculateScenario(scenario.value),
  }));

  // Calculate savings/change compared to current
  const getSavingsDisplay = (results: ScenarioResult, isCurrent: boolean) => {
    if (isCurrent) return null;
    const savings = currentResults.totalTax - results.totalTax;
    if (savings > 0) {
      return <span className="text-green-600">-{formatCurrency(savings)}</span>;
    } else if (savings < 0) {
      return <span className="text-red-600">+{formatCurrency(Math.abs(savings))}</span>;
    }
    return <span className="text-gray-500">No change</span>;
  };

  const handleApply = (value: number) => {
    onApply(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-full sm:max-w-2xl w-full p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Charitable Contributions: What If?
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info text */}
          <p className="text-sm text-gray-600 mb-4">
            See how different charitable contribution amounts would affect your federal taxes. Effective
            rate is calculated based upon gross (not taxable) income for planning purposes. Charitable
            contributions will also impact your state taxes.
          </p>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Scenario</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Amount</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Tax Due</th>
                  <th className="hidden sm:table-cell text-right py-2 px-2 font-medium text-gray-700">Eff. Rate</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Total Tax Impact</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {scenarioResults.map((scenario) => (
                  <tr
                    key={scenario.label}
                    className={`border-b border-gray-100 ${
                      scenario.isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-3 px-2 font-medium text-gray-900">
                      {scenario.label}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700">
                      {formatCurrency(scenario.value)}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-900">
                      {scenario.results.remainingOwed >= 0
                        ? formatCurrency(scenario.results.remainingOwed)
                        : `(${formatCurrency(Math.abs(scenario.results.remainingOwed))})`}
                    </td>
                    <td className="hidden sm:table-cell py-3 px-2 text-right text-gray-900">
                      {formatPercent(scenario.results.effectiveRate, 1)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {getSavingsDisplay(scenario.results, scenario.isCurrent)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {!scenario.isCurrent && (
                        <button
                          onClick={() => handleApply(scenario.value)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Apply
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
