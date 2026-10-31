"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  TaxInputs,
  FilingStatus,
  TaxState,
  STATE_LABELS,
  TaxCalculationResult,
  FederalLimitsData,
  FicaData,
  SharedLimitsData,
} from "@/lib/types";
import {
  FederalData,
  MFSScenarioResult,
  ScenarioResult,
  calculateCharitableScenario as calculateCharitableScenarioFor,
  calculateEstimate,
  calculateJointScenario,
  calculateMFSScenario as calculateMFSScenarioFor,
} from "@/lib/calculate";
import { DEFAULT_TAX_INPUTS } from "@/lib/defaultInputs";
import { loadStateData, StateData, preloadStateData } from "@/lib/stateData";
import ConfigurationSection from "./Forms/ConfigurationSection";
import DeductionInputs from "./Forms/DeductionInputs";
import IncomeInputs from "./Forms/IncomeInputs";
import PriorYearInputs from "./Forms/PriorYearInputs";
import TaxResultsDisplay from "./Displays/TaxResultsDisplay";
import WithholdingInputs from "./Forms/WithholdingInputs";
import ErrorBoundary from "./UI/ErrorBoundary";
import ThemeSelector from "./UI/ThemeSelector";
import { formatCurrency } from "@/lib/formatters";
import FilingStatusComparisonModal from "./Modals/FilingStatusComparisonModal";
import { CharitableScenario } from "@/lib/charitableScenario";
import { SplitConfig } from "@/lib/spouseInputs";
import { calculateFederalTax } from "@/lib/federalTaxCalculator";
import { estimateWithholding } from "@/lib/withholdingEstimate";

// Import federal data only (always needed) - these are small and required for all calculations
import allFederalBrackets from "@/data/federal-brackets.json";
import allFederalDeductions from "@/data/federal-deductions.json";
import allFederalLimits from "@/data/federal-limits.json";
import allFicaData from "@/data/fica.json";
import allSharedLimits from "@/data/limits.json";
import allLtcgBrackets from "@/data/federal-ltcg-brackets.json";

import { TaxYear } from "@/lib/config";

// Placeholder state result used while state data is loading
const EMPTY_STATE_RESULT: TaxCalculationResult = {
  wageIncome: 0,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  grossIncome: 0,
  adjustedGrossIncome: 0,
  taxableOrdinaryIncome: 0,
  taxableLTCG: 0,
  ordinaryIncomeTax: 0,
  ltcgTax: 0,
  ordinaryIncomeBracketBreakdown: [],
  ltcgBracketBreakdown: [],
  deductionBreakdown: {
    standardDeduction: 0,
    itemizedDeduction: 0,
    deductionAmount: 0,
    deductionUsed: "standard",
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
  },
  totalTax: 0,
  withheld: 0,
  estimatedPaid: 0,
  totalPaid: 0,
  remainingOwed: 0,
  refundDue: 0,
  contributions401k: 0,
  preTaxMedical: 0,
  shortTermLossCarryoverOffset: 0,
  longTermLossCarryoverOffset: 0,
};

// Scenario result shown while state data is loading
const EMPTY_SCENARIO: ScenarioResult = {
  federalTax: 0,
  stateTax: 0,
  totalTax: 0,
};

export default function TaxCalculator() {
  const [inputs, setInputs] = useState<TaxInputs>(DEFAULT_TAX_INPUTS);
  const [isFilingCompareOpen, setIsFilingCompareOpen] = useState(false);
  const [loadedStateData, setLoadedStateData] = useState<
    Map<string, StateData>
  >(new Map());

  const taxYear = inputs.taxYear;

  // Federal data keyed on taxYear
  const federalData = useMemo(
    (): FederalData => ({
      federalBrackets: allFederalBrackets[taxYear],
      federalDeductions: allFederalDeductions[taxYear],
      federalLimits: allFederalLimits[taxYear] as FederalLimitsData,
      ficaData: allFicaData[taxYear] as FicaData,
      ltcgBrackets: allLtcgBrackets[taxYear],
      sharedLimits: allSharedLimits[taxYear] as SharedLimitsData,
    }),
    [taxYear],
  );

  // Derive loading state from whether data exists for the selected state+year
  const stateDataKey = `${inputs.selectedState}-${taxYear}`;
  const isLoadingState = !loadedStateData.has(stateDataKey);

  // Load state data when selectedState or taxYear changes
  useEffect(() => {
    const selectedState = inputs.selectedState;
    const key = `${selectedState}-${taxYear}`;

    // If already loaded, no need to fetch
    if (loadedStateData.has(key)) {
      return;
    }

    loadStateData(selectedState, taxYear).then((data) => {
      setLoadedStateData((prev) => {
        const next = new Map(prev);
        next.set(key, data);
        return next;
      });
    });
  }, [inputs.selectedState, taxYear, loadedStateData]);

  const stateData = loadedStateData.get(stateDataKey);

  // Everything the page shows comes from one calculation in lib/calculate.ts.
  // Until the state data has loaded, the federal side runs alone against a
  // placeholder state result.
  const estimate = useMemo(() => {
    if (stateData) {
      return calculateEstimate(inputs, federalData, stateData);
    }
    const withholdingEstimate = estimateWithholding(
      inputs,
      federalData,
      undefined,
    );
    return {
      results: {
        federal: calculateFederalTax(
          inputs,
          federalData.federalBrackets,
          federalData.ltcgBrackets,
          federalData.federalDeductions,
          federalData.sharedLimits,
          federalData.federalLimits,
          federalData.ficaData,
        ),
        state: EMPTY_STATE_RESULT,
        selectedState: inputs.selectedState,
      },
      withholdingEstimate,
      resolvedInputs: inputs,
    };
  }, [inputs, federalData, stateData]);
  const { results, withholdingEstimate } = estimate;
  const calcInputs = estimate.resolvedInputs;

  const updateInput = <K extends keyof TaxInputs>(
    field: K,
    value: TaxInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  // Preload state data on hover for better UX
  const handleStateHover = useCallback(
    (state: TaxState) => {
      preloadStateData(state, taxYear);
    },
    [taxYear],
  );

  // Federal and state tax for a different amount of charitable giving, with
  // what limited the deduction (used by the charitable what-if tool)
  const calculateCharitableScenario = useMemo(
    () =>
      stateData
        ? (contributions: number): CharitableScenario =>
            calculateCharitableScenarioFor(
              calcInputs,
              contributions,
              federalData,
              stateData,
            )
        : undefined,
    [calcInputs, federalData, stateData],
  );

  // The couple's tax on one joint return, for the filing status comparison
  const mfjResults: ScenarioResult = useMemo(
    () =>
      stateData
        ? calculateJointScenario(calcInputs, federalData, stateData)
        : EMPTY_SCENARIO,
    [calcInputs, federalData, stateData],
  );

  // The couple's tax on two separate returns, divided by the spouse splits
  const calculateMFSScenario = useCallback(
    (splits: SplitConfig): MFSScenarioResult =>
      stateData
        ? calculateMFSScenarioFor(calcInputs, splits, federalData, stateData)
        : {
            spouse1: EMPTY_SCENARIO,
            spouse2: EMPTY_SCENARIO,
            combined: EMPTY_SCENARIO,
          },
    [calcInputs, federalData, stateData],
  );

  const stateLabel = STATE_LABELS[inputs.selectedState];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary font-display">
            {taxYear} Estimated Tax Calculator
          </h1>
          <p className="text-text-secondary mt-2">
            Federal & {stateLabel} Tax Estimation
          </p>
        </div>

      <div className="space-y-6">
        {/* Row 1: Config + Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigurationSection
            filingStatus={inputs.filingStatus}
            selectedState={inputs.selectedState}
            taxYear={taxYear}
            isNYCResident={inputs.isNYCResident}
            onFilingStatusChange={(status: FilingStatus) =>
              updateInput("filingStatus", status)
            }
            onStateChange={(state: TaxState) =>
              updateInput("selectedState", state)
            }
            onTaxYearChange={(year: TaxYear) =>
              updateInput("taxYear", year)
            }
            onNYCResidentChange={(isNYC: boolean) =>
              updateInput("isNYCResident", isNYC)
            }
            onCompareFilingStatus={() => setIsFilingCompareOpen(true)}
            onStateHover={handleStateHover}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={`theme-card p-4 ${
                results.federal.remainingOwed > 0
                  ? "bg-negative-bg border-l-4 border-l-negative"
                  : "bg-positive-bg border-l-4 border-l-positive"
              }`}
            >
              <h3 className="text-sm font-medium text-text-primary">Federal</h3>
              {results.federal.remainingOwed > 0 ? (
                <p className="text-2xl font-bold text-negative number-transition">
                  {formatCurrency(results.federal.remainingOwed)} owed
                </p>
              ) : (
                <p className="text-2xl font-bold text-positive number-transition">
                  {formatCurrency(results.federal.refundDue)} refund
                </p>
              )}
            </div>

            <div
              className={`theme-card p-4 ${
                results.state.remainingOwed > 0
                  ? "bg-negative-bg border-l-4 border-l-negative"
                  : "bg-positive-bg border-l-4 border-l-positive"
              }`}
            >
              <h3 className="text-sm font-medium text-text-primary">
                {stateLabel}
              </h3>
              {isLoadingState ? (
                <p className="text-2xl font-bold text-text-muted">Loading...</p>
              ) : results.state.remainingOwed > 0 ? (
                <p className="text-2xl font-bold text-negative number-transition">
                  {formatCurrency(results.state.remainingOwed)} owed
                </p>
              ) : (
                <p className="text-2xl font-bold text-positive number-transition">
                  {formatCurrency(results.state.refundDue)} refund
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Inputs + Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <IncomeInputs
              inputs={inputs}
              onUpdate={updateInput}
              sharedLimits={federalData.sharedLimits}
            />

            <WithholdingInputs
              inputs={inputs}
              onUpdate={updateInput}
              estimate={withholdingEstimate}
            />

            <DeductionInputs
              inputs={inputs}
              onUpdate={updateInput}
              sharedLimits={federalData.sharedLimits}
              federalLimits={federalData.federalLimits}
              federalAgi={results.federal.adjustedGrossIncome}
              calculateCharitableScenario={calculateCharitableScenario}
            />

            <PriorYearInputs
              inputs={inputs}
              onUpdate={updateInput}
              sharedLimits={federalData.sharedLimits}
            />
          </div>

          <ErrorBoundary>
            <TaxResultsDisplay results={results} taxYear={taxYear} />
          </ErrorBoundary>
        </div>
      </div>

        <footer className="mt-8 pt-6 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-text-muted">
              This calculator provides estimates only. Consult a tax professional
              for actual tax advice.
            </p>
            <ThemeSelector />
          </div>
        </footer>
      </div>

      <FilingStatusComparisonModal
        isOpen={isFilingCompareOpen}
        onClose={() => setIsFilingCompareOpen(false)}
        currentInputs={calcInputs}
        mfjResults={mfjResults}
        calculateMFSScenario={calculateMFSScenario}
      />
    </div>
  );
}
