'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { TaxInputs } from '@/lib/types';

export interface SplitConfig {
  wages: number;
  stcg: number;
  ltcg: number;
  contributions401k: number;
  preTaxMedical: number;
  deductions: number;
}

export interface ScenarioResult {
  federalTax: number;
  stateTax: number;
  totalTax: number;
}

export interface MFSScenarioResult {
  spouse1: ScenarioResult;
  spouse2: ScenarioResult;
  combined: ScenarioResult;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentInputs: TaxInputs;
  mfjResults: ScenarioResult;
  calculateMFSScenario: (splits: SplitConfig) => MFSScenarioResult;
}

interface SplitSliderProps {
  label: string;
  totalAmount: number;
  spouse1Percent: number;
  onChange: (percent: number) => void;
}

function SplitSlider({ label, totalAmount, spouse1Percent, onChange }: SplitSliderProps) {
  const spouse1Amount = totalAmount * (spouse1Percent / 100);
  const spouse2Amount = totalAmount - spouse1Amount;

  if (totalAmount === 0) {
    return null;
  }

  return (
    <div className="py-2">
      {/* Mobile: Stacked layout */}
      <div className="sm:hidden space-y-1">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">({formatCurrency(totalAmount)})</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={spouse1Percent}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-sm tabular-nums">
          <span className="text-gray-700">{spouse1Percent}% / {100 - spouse1Percent}%</span>
          <span className="text-gray-400">{formatCurrency(spouse1Amount)} / {formatCurrency(spouse2Amount)}</span>
        </div>
      </div>

      {/* Desktop: Horizontal layout */}
      <div className="hidden sm:flex items-center gap-3">
        {/* Column 1: Category */}
        <div className="w-52 shrink-0 text-sm text-gray-700">
          <span className="font-medium">{label}</span>
          <span className="text-gray-500 ml-1">({formatCurrency(totalAmount)})</span>
        </div>
        {/* Column 2: Slider */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={spouse1Percent}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
        {/* Column 3: Percentages */}
        <div className="w-24 shrink-0 text-sm text-right tabular-nums">
          <span className="text-gray-700">{spouse1Percent}%</span>
          <span className="text-gray-400 mx-1">/</span>
          <span className="text-gray-700">{100 - spouse1Percent}%</span>
        </div>
        {/* Column 4: Dollars */}
        <div className="w-44 shrink-0 text-sm text-right text-gray-400 tabular-nums">
          {formatCurrency(spouse1Amount)} / {formatCurrency(spouse2Amount)}
        </div>
      </div>
    </div>
  );
}

export default function FilingStatusComparisonModal({
  isOpen,
  onClose,
  currentInputs,
  mfjResults,
  calculateMFSScenario,
}: Props) {
  const [splits, setSplits] = useState<SplitConfig>({
    wages: 50,
    stcg: 50,
    ltcg: 50,
    contributions401k: 50,
    preTaxMedical: 50,
    deductions: 50,
  });

  const updateSplit = (key: keyof SplitConfig, value: number) => {
    setSplits((prev) => ({ ...prev, [key]: value }));
  };

  const mfsResults = useMemo(() => {
    return calculateMFSScenario(splits);
  }, [splits, calculateMFSScenario]);

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

  const totalWages = currentInputs.federalIncome + (currentInputs.selfEmploymentIncome || 0);
  const totalDeductions =
    currentInputs.mortgageInterestPaid +
    currentInputs.propertyTaxesPaid +
    currentInputs.charitableContributions;

  const taxDifference = mfsResults.combined.totalTax - mfjResults.totalTax;

  const getDifferenceDisplay = (diff: number) => {
    if (diff > 0) {
      return <span className="text-red-600">+{formatCurrency(diff)}</span>;
    } else if (diff < 0) {
      return <span className="text-green-600">-{formatCurrency(Math.abs(diff))}</span>;
    }
    return <span className="text-gray-500">No change</span>;
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-full sm:max-w-4xl w-full p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Compare MFJ vs MFS
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
            Allocate income and deductions between spouses to roughly reflect each's
            share to compare Married Filing Jointly vs Married Filing Separately.
          </p>

          {/* Split Configuration */}
          <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
            <div className="hidden sm:flex items-center justify-between mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Category</span>
              <span>Spouse 1 / Spouse 2</span>
            </div>
            <div className="space-y-1">
              <SplitSlider
                label="Wages"
                totalAmount={totalWages}
                spouse1Percent={splits.wages}
                onChange={(v) => updateSplit('wages', v)}
              />
              <SplitSlider
                label="STCG"
                totalAmount={currentInputs.shortTermCapitalGains}
                spouse1Percent={splits.stcg}
                onChange={(v) => updateSplit('stcg', v)}
              />
              <SplitSlider
                label="LTCG"
                totalAmount={currentInputs.longTermCapitalGains}
                spouse1Percent={splits.ltcg}
                onChange={(v) => updateSplit('ltcg', v)}
              />
              <SplitSlider
                label="401(k)"
                totalAmount={currentInputs.contributions401k}
                spouse1Percent={splits.contributions401k}
                onChange={(v) => updateSplit('contributions401k', v)}
              />
              <SplitSlider
                label="Pre-Tax Medical"
                totalAmount={currentInputs.preTaxMedical}
                spouse1Percent={splits.preTaxMedical}
                onChange={(v) => updateSplit('preTaxMedical', v)}
              />
              <SplitSlider
                label="Deductions"
                totalAmount={totalDeductions}
                spouse1Percent={splits.deductions}
                onChange={(v) => updateSplit('deductions', v)}
              />
            </div>
          </div>

          {/* Results Comparison */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-700"></th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">MFJ</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">MFS (Combined)</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">Difference</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-2 text-gray-700">Federal Tax</td>
                  <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(mfjResults.federalTax)}</td>
                  <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(mfsResults.combined.federalTax)}</td>
                  <td className="py-2 px-2 text-right">
                    {getDifferenceDisplay(mfsResults.combined.federalTax - mfjResults.federalTax)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-2 text-gray-700">State Tax</td>
                  <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(mfjResults.stateTax)}</td>
                  <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(mfsResults.combined.stateTax)}</td>
                  <td className="py-2 px-2 text-right">
                    {getDifferenceDisplay(mfsResults.combined.stateTax - mfjResults.stateTax)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200 font-medium">
                  <td className="py-2 px-2 text-gray-900">Total</td>
                  <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(mfjResults.totalTax)}</td>
                  <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(mfsResults.combined.totalTax)}</td>
                  <td className="py-2 px-2 text-right">{getDifferenceDisplay(taxDifference)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-end">
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
