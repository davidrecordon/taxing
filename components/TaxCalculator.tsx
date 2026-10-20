"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  TaxInputs,
  FilingStatus,
  TaxState,
  CalculationResults,
  STATE_LABELS,
  TaxCalculationResult,
  SharedLimitsData,
  FederalLimitsData,
  FicaData,
} from "@/lib/types";
import { calculateFederalTax } from "@/lib/federalTaxCalculator";
import { calculateCaliforniaTax } from "@/lib/states/californiaTaxCalculator";
import { calculateColoradoTax } from "@/lib/states/coloradoTaxCalculator";
import { calculateDCTax } from "@/lib/states/dcTaxCalculator";
import { calculateFloridaTax } from "@/lib/states/floridaTaxCalculator";
import { calculateIllinoisTax } from "@/lib/states/illinoisTaxCalculator";
import { calculateNewYorkTax } from "@/lib/states/newYorkTaxCalculator";
import { calculateWashingtonTax } from "@/lib/states/washingtonTaxCalculator";
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
import FilingStatusComparisonModal, {
  SplitConfig,
  ScenarioResult,
  MFSScenarioResult,
} from "./Modals/FilingStatusComparisonModal";

// Import federal data only (always needed) - these are small and required for all calculations
import allFederalBrackets from "@/data/federal-brackets.json";
import allFederalDeductions from "@/data/federal-deductions.json";
import allFederalLimits from "@/data/federal-limits.json";
import allFicaData from "@/data/fica.json";
import allSharedLimits from "@/data/limits.json";
import allLtcgBrackets from "@/data/federal-ltcg-brackets.json";

import { TAX_YEAR, TaxYear } from "@/lib/config";

const defaultInputs: TaxInputs = {
  taxYear: TAX_YEAR,
  federalIncome: 0,
  stateIncome: 0,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  interestIncome: 0,
  ordinaryDividends: 0,
  qualifiedDividends: 0,
  federalTaxWithheld: 0,
  stateTaxWithheld: 0,
  federalEstimatedPaid: 0,
  stateEstimatedPaid: 0,
  filingStatus: "single",
  selectedState: "california",
  propertyTaxesPaid: 0,
  mortgageInterestPaid: 0,
  mortgageBalance: 0,
  charitableContributions: 0,
  contributions401k: 0,
  preTaxMedical: 0,
  priorYearFederalTaxPaid: 0,
  priorYearStateTaxPaid: 0,
  priorYearShortTermLossCarryover: 0,
  priorYearLongTermLossCarryover: 0,
  selfEmploymentIncome: 0,
};

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

// Build one spouse's inputs for the married-filing-separately comparison.
// Each split is spouse 1's percentage; spouse 2 gets the remainder.
function buildSpouseInputs(
  inputs: TaxInputs,
  splits: SplitConfig,
  isSpouse1: boolean,
): TaxInputs {
  const share = (spouse1Percent: number) =>
    (isSpouse1 ? spouse1Percent : 100 - spouse1Percent) / 100;
  const contributions401k = share(splits.contributions401k);
  const deductions = share(splits.deductions);
  const dividends = share(splits.dividends);
  const ltcg = share(splits.ltcg);
  const preTaxMedical = share(splits.preTaxMedical);
  const stcg = share(splits.stcg);
  const wages = share(splits.wages);

  return {
    ...inputs,
    filingStatus: "marriedFilingSeparately",
    federalIncome: inputs.federalIncome * wages,
    stateIncome: inputs.stateIncome * wages,
    selfEmploymentIncome: (inputs.selfEmploymentIncome || 0) * wages,
    shortTermCapitalGains: inputs.shortTermCapitalGains * stcg,
    longTermCapitalGains: inputs.longTermCapitalGains * ltcg,
    interestIncome: inputs.interestIncome * dividends,
    ordinaryDividends: inputs.ordinaryDividends * dividends,
    qualifiedDividends: inputs.qualifiedDividends * dividends,
    contributions401k: inputs.contributions401k * contributions401k,
    preTaxMedical: inputs.preTaxMedical * preTaxMedical,
    mortgageInterestPaid: inputs.mortgageInterestPaid * deductions,
    mortgageBalance: inputs.mortgageBalance * deductions,
    propertyTaxesPaid: inputs.propertyTaxesPaid * deductions,
    charitableContributions: inputs.charitableContributions * deductions,
    priorYearShortTermLossCarryover:
      inputs.priorYearShortTermLossCarryover * stcg,
    priorYearLongTermLossCarryover:
      inputs.priorYearLongTermLossCarryover * ltcg,
    federalTaxWithheld: inputs.federalTaxWithheld * wages,
    stateTaxWithheld: inputs.stateTaxWithheld * wages,
    federalEstimatedPaid: inputs.federalEstimatedPaid * wages,
    stateEstimatedPaid: inputs.stateEstimatedPaid * wages,
    priorYearFederalTaxPaid: inputs.priorYearFederalTaxPaid * wages,
    priorYearStateTaxPaid: inputs.priorYearStateTaxPaid * wages,
  };
}

// Helper to calculate state tax with loaded data
function calculateStateTaxWithData(
  inputs: TaxInputs,
  stateData: StateData,
  sharedLimits: SharedLimitsData,
  federalLimits: FederalLimitsData,
  ficaData: FicaData,
  federal: TaxCalculationResult,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brackets = stateData.brackets as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deductions = stateData.deductions as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limits = stateData.limits as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nycBrackets = (stateData as any).nycBrackets;

  switch (inputs.selectedState) {
    case "california":
      return calculateCaliforniaTax(
        inputs,
        brackets,
        deductions,
        sharedLimits,
        limits,
        ficaData,
      );
    case "colorado":
      return calculateColoradoTax(
        inputs,
        brackets,
        sharedLimits,
        limits,
        federal,
        ficaData,
      );
    case "dc":
      return calculateDCTax(
        inputs,
        brackets,
        deductions,
        sharedLimits,
        federalLimits,
        limits,
        ficaData,
        federal.deductionBreakdown,
      );
    case "florida":
      return calculateFloridaTax(inputs);
    case "illinois":
      return calculateIllinoisTax(
        inputs,
        brackets,
        deductions,
        sharedLimits,
        limits,
        ficaData,
      );
    case "newyork":
      return calculateNewYorkTax(
        inputs,
        brackets,
        nycBrackets,
        deductions,
        sharedLimits,
        limits,
        ficaData,
      );
    case "washington":
    default:
      return calculateWashingtonTax(inputs, brackets, limits);
  }
}

export default function TaxCalculator() {
  const [inputs, setInputs] = useState<TaxInputs>(defaultInputs);
  const [isFilingCompareOpen, setIsFilingCompareOpen] = useState(false);
  const [loadedStateData, setLoadedStateData] = useState<
    Map<string, StateData>
  >(new Map());

  const taxYear = inputs.taxYear;

  // Federal data keyed on taxYear
  const federalData = useMemo(
    () => ({
      federalBrackets: allFederalBrackets[taxYear],
      federalDeductions: allFederalDeductions[taxYear],
      federalLimits: allFederalLimits[taxYear] as FederalLimitsData,
      ficaData: allFicaData[taxYear] as FicaData,
      ltcgBrackets: allLtcgBrackets[taxYear],
      sharedLimits: allSharedLimits[taxYear] as SharedLimitsData,
    }),
    [taxYear],
  );

  // Federal calculation bound to the selected year's data
  const calculateFederal = useCallback(
    (federalInputs: TaxInputs) =>
      calculateFederalTax(
        federalInputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
      ),
    [federalData],
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

  // Get the current state's data (may be undefined while loading)
  const currentStateData = loadedStateData.get(stateDataKey);

  const results: CalculationResults = useMemo(() => {
    const federal = calculateFederal(inputs);

    // If state data isn't loaded yet, return a placeholder state result
    if (!currentStateData) {
      return {
        federal,
        state: EMPTY_STATE_RESULT,
        selectedState: inputs.selectedState,
      };
    }

    const state = calculateStateTaxWithData(
      inputs,
      currentStateData,
      federalData.sharedLimits,
      federalData.federalLimits,
      federalData.ficaData,
      federal,
    );

    return { federal, state, selectedState: inputs.selectedState };
  }, [inputs, currentStateData, federalData, calculateFederal]);

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

  // Calculate federal tax scenario with different charitable contributions
  const calculateCharitableScenario = useCallback(
    (contributions: number) => {
      const modifiedInputs = {
        ...inputs,
        charitableContributions: contributions,
      };
      const scenarioResult = calculateFederal(modifiedInputs);
      return {
        totalTax: scenarioResult.totalTax,
        remainingOwed: scenarioResult.remainingOwed,
        effectiveRate:
          scenarioResult.grossIncome > 0
            ? scenarioResult.totalTax / scenarioResult.grossIncome
            : 0,
      };
    },
    [inputs, calculateFederal],
  );

  // Extract federal results for the modal
  const federalResultsForModal = useMemo(
    () => ({
      totalTax: results.federal.totalTax,
      remainingOwed: results.federal.remainingOwed,
      effectiveRate:
        results.federal.grossIncome > 0
          ? results.federal.totalTax / results.federal.grossIncome
          : 0,
    }),
    [results.federal],
  );

  // Helper to calculate state tax for a given set of inputs (used by MFJ/MFS scenarios)
  const calculateStateForInputs = useCallback(
    (stateInputs: TaxInputs) => {
      const key = `${stateInputs.selectedState}-${taxYear}`;
      const stateData = loadedStateData.get(key);
      if (!stateData) {
        // Return zero result if state data not loaded (shouldn't happen in practice)
        return EMPTY_STATE_RESULT;
      }
      const federalResult = calculateFederal(stateInputs);
      return calculateStateTaxWithData(
        stateInputs,
        stateData,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
        federalResult,
      );
    },
    [loadedStateData, taxYear, federalData, calculateFederal],
  );

  // Calculate MFJ scenario results for filing status comparison
  const mfjResults: ScenarioResult = useMemo(() => {
    const mfjInputs = {
      ...inputs,
      filingStatus: "marriedFilingJointly" as const,
    };
    const federal = calculateFederal(mfjInputs);
    const state = calculateStateForInputs(mfjInputs);
    return {
      federalTax: federal.totalTax,
      stateTax: state.totalTax,
      totalTax: federal.totalTax + state.totalTax,
    };
  }, [inputs, calculateStateForInputs, calculateFederal]);

  // Calculate MFS scenario with spouse splits
  const calculateMFSScenario = useCallback(
    (splits: SplitConfig): MFSScenarioResult => {
      const spouse1Inputs = buildSpouseInputs(inputs, splits, true);
      const spouse2Inputs = buildSpouseInputs(inputs, splits, false);

      // Calculate each spouse's taxes
      const spouse1Federal = calculateFederal(spouse1Inputs);
      const spouse1State = calculateStateForInputs(spouse1Inputs);
      const spouse2Federal = calculateFederal(spouse2Inputs);
      const spouse2State = calculateStateForInputs(spouse2Inputs);

      return {
        spouse1: {
          federalTax: spouse1Federal.totalTax,
          stateTax: spouse1State.totalTax,
          totalTax: spouse1Federal.totalTax + spouse1State.totalTax,
        },
        spouse2: {
          federalTax: spouse2Federal.totalTax,
          stateTax: spouse2State.totalTax,
          totalTax: spouse2Federal.totalTax + spouse2State.totalTax,
        },
        combined: {
          federalTax: spouse1Federal.totalTax + spouse2Federal.totalTax,
          stateTax: spouse1State.totalTax + spouse2State.totalTax,
          totalTax:
            spouse1Federal.totalTax +
            spouse2Federal.totalTax +
            spouse1State.totalTax +
            spouse2State.totalTax,
        },
      };
    },
    [inputs, calculateStateForInputs, calculateFederal],
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

            <WithholdingInputs inputs={inputs} onUpdate={updateInput} />

            <DeductionInputs
              inputs={inputs}
              onUpdate={updateInput}
              sharedLimits={federalData.sharedLimits}
              federalLimits={federalData.federalLimits}
              federalAgi={results.federal.adjustedGrossIncome}
              federalResults={federalResultsForModal}
              calculateCharitableScenario={calculateCharitableScenario}
            />

            <PriorYearInputs inputs={inputs} onUpdate={updateInput} />
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
        currentInputs={inputs}
        mfjResults={mfjResults}
        calculateMFSScenario={calculateMFSScenario}
      />
    </div>
  );
}
