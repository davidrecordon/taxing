"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  TaxInputs,
  FilingStatus,
  TaxState,
  CalculationResults,
  STATE_LABELS,
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

// Helper to calculate state tax with loaded data
function calculateStateTaxWithData(
  inputs: TaxInputs,
  stateData: StateData,
  sharedLimits: SharedLimitsData,
  federalLimits: FederalLimitsData,
  ficaData: FicaData,
  federalTaxableIncome?: number,
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
        federalTaxableIncome ?? 0,
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
        federalLimits,
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
    const federal = calculateFederalTax(
      inputs,
      federalData.federalBrackets,
      federalData.ltcgBrackets,
      federalData.federalDeductions,
      federalData.sharedLimits,
      federalData.federalLimits,
      federalData.ficaData,
    );

    // If state data isn't loaded yet, return a placeholder state result
    if (!currentStateData) {
      return {
        federal,
        state: {
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
            deductionUsed: "standard" as const,
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
        },
        selectedState: inputs.selectedState,
      };
    }

    const federalTaxableIncome =
      federal.taxableOrdinaryIncome + federal.taxableLTCG;
    const state = calculateStateTaxWithData(
      inputs,
      currentStateData,
      federalData.sharedLimits,
      federalData.federalLimits,
      federalData.ficaData,
      federalTaxableIncome,
    );

    return { federal, state, selectedState: inputs.selectedState };
  }, [inputs, currentStateData, federalData]);

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
      const scenarioResult = calculateFederalTax(
        modifiedInputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
      );
      return {
        totalTax: scenarioResult.totalTax,
        remainingOwed: scenarioResult.remainingOwed,
        effectiveRate:
          scenarioResult.grossIncome > 0
            ? scenarioResult.totalTax / scenarioResult.grossIncome
            : 0,
      };
    },
    [inputs, federalData],
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
        return {
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
            deductionUsed: "standard" as const,
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
      }
      const federalResult = calculateFederalTax(
        stateInputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
      );
      return calculateStateTaxWithData(
        stateInputs,
        stateData,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
        federalResult.taxableOrdinaryIncome + federalResult.taxableLTCG,
      );
    },
    [loadedStateData, taxYear, federalData],
  );

  // Calculate MFJ scenario results for filing status comparison
  const mfjResults: ScenarioResult = useMemo(() => {
    const mfjInputs = {
      ...inputs,
      filingStatus: "marriedFilingJointly" as const,
    };
    const federal = calculateFederalTax(
      mfjInputs,
      federalData.federalBrackets,
      federalData.ltcgBrackets,
      federalData.federalDeductions,
      federalData.sharedLimits,
      federalData.federalLimits,
      federalData.ficaData,
    );
    const state = calculateStateForInputs(mfjInputs);
    return {
      federalTax: federal.totalTax,
      stateTax: state.totalTax,
      totalTax: federal.totalTax + state.totalTax,
    };
  }, [inputs, calculateStateForInputs, federalData]);

  // Calculate MFS scenario with spouse splits
  const calculateMFSScenario = useCallback(
    (splits: SplitConfig): MFSScenarioResult => {
      // Build Spouse 1 inputs
      const spouse1Inputs: TaxInputs = {
        ...inputs,
        filingStatus: "marriedFilingSeparately",
        federalIncome: inputs.federalIncome * (splits.wages / 100),
        stateIncome: inputs.stateIncome * (splits.wages / 100),
        selfEmploymentIncome:
          (inputs.selfEmploymentIncome || 0) * (splits.wages / 100),
        shortTermCapitalGains:
          inputs.shortTermCapitalGains * (splits.stcg / 100),
        longTermCapitalGains: inputs.longTermCapitalGains * (splits.ltcg / 100),
        contributions401k:
          inputs.contributions401k * (splits.contributions401k / 100),
        preTaxMedical: inputs.preTaxMedical * (splits.preTaxMedical / 100),
        mortgageInterestPaid:
          inputs.mortgageInterestPaid * (splits.deductions / 100),
        mortgageBalance: inputs.mortgageBalance * (splits.deductions / 100),
        propertyTaxesPaid: inputs.propertyTaxesPaid * (splits.deductions / 100),
        charitableContributions:
          inputs.charitableContributions * (splits.deductions / 100),
        priorYearShortTermLossCarryover:
          inputs.priorYearShortTermLossCarryover * (splits.stcg / 100),
        priorYearLongTermLossCarryover:
          inputs.priorYearLongTermLossCarryover * (splits.ltcg / 100),
        federalTaxWithheld: inputs.federalTaxWithheld * (splits.wages / 100),
        stateTaxWithheld: inputs.stateTaxWithheld * (splits.wages / 100),
        federalEstimatedPaid:
          inputs.federalEstimatedPaid * (splits.wages / 100),
        stateEstimatedPaid: inputs.stateEstimatedPaid * (splits.wages / 100),
        priorYearFederalTaxPaid:
          inputs.priorYearFederalTaxPaid * (splits.wages / 100),
        priorYearStateTaxPaid:
          inputs.priorYearStateTaxPaid * (splits.wages / 100),
      };

      // Build Spouse 2 inputs (inverse percentages)
      const spouse2Inputs: TaxInputs = {
        ...inputs,
        filingStatus: "marriedFilingSeparately",
        federalIncome: inputs.federalIncome * ((100 - splits.wages) / 100),
        stateIncome: inputs.stateIncome * ((100 - splits.wages) / 100),
        selfEmploymentIncome:
          (inputs.selfEmploymentIncome || 0) * ((100 - splits.wages) / 100),
        shortTermCapitalGains:
          inputs.shortTermCapitalGains * ((100 - splits.stcg) / 100),
        longTermCapitalGains:
          inputs.longTermCapitalGains * ((100 - splits.ltcg) / 100),
        contributions401k:
          inputs.contributions401k * ((100 - splits.contributions401k) / 100),
        preTaxMedical:
          inputs.preTaxMedical * ((100 - splits.preTaxMedical) / 100),
        mortgageInterestPaid:
          inputs.mortgageInterestPaid * ((100 - splits.deductions) / 100),
        mortgageBalance:
          inputs.mortgageBalance * ((100 - splits.deductions) / 100),
        propertyTaxesPaid:
          inputs.propertyTaxesPaid * ((100 - splits.deductions) / 100),
        charitableContributions:
          inputs.charitableContributions * ((100 - splits.deductions) / 100),
        priorYearShortTermLossCarryover:
          inputs.priorYearShortTermLossCarryover * ((100 - splits.stcg) / 100),
        priorYearLongTermLossCarryover:
          inputs.priorYearLongTermLossCarryover * ((100 - splits.ltcg) / 100),
        federalTaxWithheld:
          inputs.federalTaxWithheld * ((100 - splits.wages) / 100),
        stateTaxWithheld:
          inputs.stateTaxWithheld * ((100 - splits.wages) / 100),
        federalEstimatedPaid:
          inputs.federalEstimatedPaid * ((100 - splits.wages) / 100),
        stateEstimatedPaid:
          inputs.stateEstimatedPaid * ((100 - splits.wages) / 100),
        priorYearFederalTaxPaid:
          inputs.priorYearFederalTaxPaid * ((100 - splits.wages) / 100),
        priorYearStateTaxPaid:
          inputs.priorYearStateTaxPaid * ((100 - splits.wages) / 100),
      };

      // Calculate each spouse's taxes
      const spouse1Federal = calculateFederalTax(
        spouse1Inputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
      );
      const spouse1State = calculateStateForInputs(spouse1Inputs);
      const spouse2Federal = calculateFederalTax(
        spouse2Inputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
      );
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
    [inputs, calculateStateForInputs, federalData],
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
            <IncomeInputs inputs={inputs} onUpdate={updateInput} />

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
