"use client";

import { useState, useMemo } from "react";
import { MFSScenarioResult, ScenarioResult } from "@/lib/calculate";
import { formatCurrency } from "@/lib/formatters";
import { defaultWagesSplit, SplitConfig } from "@/lib/spouseInputs";
import { TaxInputs } from "@/lib/types";
import Dialog from "../UI/Dialog";

export type { MFSScenarioResult, ScenarioResult };

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

function SplitSlider({
  label,
  totalAmount,
  spouse1Percent,
  onChange,
}: SplitSliderProps) {
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
          <span className="font-medium text-text-primary">{label}</span>
          <span className="text-text-muted">({formatCurrency(totalAmount)})</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={spouse1Percent}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-sm tabular-nums">
          <span className="text-text-primary">
            {spouse1Percent}% / {100 - spouse1Percent}%
          </span>
          <span className="text-text-muted">
            {formatCurrency(spouse1Amount)} / {formatCurrency(spouse2Amount)}
          </span>
        </div>
      </div>

      {/* Desktop: Horizontal layout */}
      <div className="hidden sm:flex items-center gap-3">
        {/* Column 1: Category */}
        <div className="w-52 shrink-0 text-sm text-text-primary">
          <span className="font-medium">{label}</span>
          <span className="text-text-muted ml-1">
            ({formatCurrency(totalAmount)})
          </span>
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
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>
        {/* Column 3: Percentages */}
        <div className="w-24 shrink-0 text-sm text-right tabular-nums">
          <span className="text-text-primary">{spouse1Percent}%</span>
          <span className="text-text-muted mx-1">/</span>
          <span className="text-text-primary">{100 - spouse1Percent}%</span>
        </div>
        {/* Column 4: Dollars */}
        <div className="w-44 shrink-0 text-sm text-right text-text-muted tabular-nums">
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
  // The wages slider starts where the spouse's wages put it, until it is moved
  const [wagesSplit, setWagesSplit] = useState<number | null>(null);
  const [otherSplits, setOtherSplits] = useState<Omit<SplitConfig, "wages">>({
    stcg: 50,
    ltcg: 50,
    dividends: 50,
    contributions401k: 50,
    preTaxMedical: 50,
    deductions: 50,
  });
  const splits: SplitConfig = useMemo(
    () => ({
      ...otherSplits,
      wages: wagesSplit ?? defaultWagesSplit(currentInputs),
    }),
    [currentInputs, otherSplits, wagesSplit],
  );

  const updateSplit = (key: keyof SplitConfig, value: number) => {
    if (key === "wages") {
      setWagesSplit(value);
    } else {
      setOtherSplits((prev) => ({ ...prev, [key]: value }));
    }
  };

  const mfsResults = useMemo(() => {
    return calculateMFSScenario(splits);
  }, [splits, calculateMFSScenario]);

  if (!isOpen) return null;

  const totalWages =
    currentInputs.federalIncome + (currentInputs.selfEmploymentIncome || 0);
  const totalDeductions =
    currentInputs.mortgageInterestPaid +
    currentInputs.propertyTaxesPaid +
    currentInputs.charitableContributions;

  const taxDifference = mfsResults.combined.totalTax - mfjResults.totalTax;

  const getDifferenceDisplay = (diff: number) => {
    if (diff > 0) {
      return <span className="text-negative">+{formatCurrency(diff)}</span>;
    } else if (diff < 0) {
      return (
        <span className="text-positive">
          -{formatCurrency(Math.abs(diff))}
        </span>
      );
    }
    return <span className="text-text-muted">No change</span>;
  };

  return (
    <Dialog title="Compare MFJ vs MFS" onClose={onClose} size="large">
      {/* Info text */}
      <p className="text-sm text-text-secondary mb-4">
        Allocate income and deductions between spouses to roughly reflect
        each spouse&apos;s share to compare Married Filing Jointly vs
        Married Filing Separately.
      </p>

      {/* Split Configuration */}
      <div className="border border-border rounded-[var(--radius-lg)] p-4 mb-4 bg-secondary">
        <div className="hidden sm:flex items-center justify-between mb-2 text-xs font-medium text-text-muted uppercase tracking-wider">
          <span>Category</span>
          <span>Spouse 1 / Spouse 2</span>
        </div>
        <div className="space-y-1">
          <SplitSlider
            label="Wages"
            totalAmount={totalWages}
            spouse1Percent={splits.wages}
            onChange={(v) => updateSplit("wages", v)}
          />
          <SplitSlider
            label="STCG"
            totalAmount={currentInputs.shortTermCapitalGains}
            spouse1Percent={splits.stcg}
            onChange={(v) => updateSplit("stcg", v)}
          />
          <SplitSlider
            label="LTCG"
            totalAmount={currentInputs.longTermCapitalGains}
            spouse1Percent={splits.ltcg}
            onChange={(v) => updateSplit("ltcg", v)}
          />
          <SplitSlider
            label="Interest & Dividends"
            totalAmount={
              currentInputs.interestIncome + currentInputs.ordinaryDividends
            }
            spouse1Percent={splits.dividends}
            onChange={(v) => updateSplit("dividends", v)}
          />
          <SplitSlider
            label="401(k)"
            totalAmount={currentInputs.contributions401k}
            spouse1Percent={splits.contributions401k}
            onChange={(v) => updateSplit("contributions401k", v)}
          />
          <SplitSlider
            label="Pre-Tax Medical"
            totalAmount={currentInputs.preTaxMedical}
            spouse1Percent={splits.preTaxMedical}
            onChange={(v) => updateSplit("preTaxMedical", v)}
          />
          <SplitSlider
            label="Deductions"
            totalAmount={totalDeductions}
            spouse1Percent={splits.deductions}
            onChange={(v) => updateSplit("deductions", v)}
          />
        </div>
      </div>

      {/* Results Comparison */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-medium text-text-primary"></th>
              <th className="text-right py-2 px-2 font-medium text-text-primary">
                MFJ
              </th>
              <th className="text-right py-2 px-2 font-medium text-text-primary">
                MFS (Combined)
              </th>
              <th className="text-right py-2 px-2 font-medium text-text-primary">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 px-2 text-text-secondary">Federal Tax</td>
              <td className="py-2 px-2 text-right text-text-primary">
                {formatCurrency(mfjResults.federalTax)}
              </td>
              <td className="py-2 px-2 text-right text-text-primary">
                {formatCurrency(mfsResults.combined.federalTax)}
              </td>
              <td className="py-2 px-2 text-right">
                {getDifferenceDisplay(
                  mfsResults.combined.federalTax - mfjResults.federalTax,
                )}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 px-2 text-text-secondary">State Tax</td>
              <td className="py-2 px-2 text-right text-text-primary">
                {formatCurrency(mfjResults.stateTax)}
              </td>
              <td className="py-2 px-2 text-right text-text-primary">
                {formatCurrency(mfsResults.combined.stateTax)}
              </td>
              <td className="py-2 px-2 text-right">
                {getDifferenceDisplay(
                  mfsResults.combined.stateTax - mfjResults.stateTax,
                )}
              </td>
            </tr>
            <tr className="border-b border-border font-medium">
              <td className="py-2 px-2 text-text-primary">Total</td>
              <td className="py-2 px-2 text-right text-text-primary">
                {formatCurrency(mfjResults.totalTax)}
              </td>
              <td className="py-2 px-2 text-right text-text-primary">
                {formatCurrency(mfsResults.combined.totalTax)}
              </td>
              <td className="py-2 px-2 text-right">
                {getDifferenceDisplay(taxDifference)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
