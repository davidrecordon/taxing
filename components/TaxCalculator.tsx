'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { TaxInputs, FilingStatus, TaxState, CalculationResults, STATE_LABELS } from '@/lib/types';
import { calculateFederalTax } from '@/lib/federalTaxCalculator';
import { calculateCaliforniaTax } from '@/lib/states/californiaTaxCalculator';
import { calculateColoradoTax } from '@/lib/states/coloradoTaxCalculator';
import { calculateDCTax } from '@/lib/states/dcTaxCalculator';
import { calculateFloridaTax } from '@/lib/states/floridaTaxCalculator';
import { calculateIllinoisTax } from '@/lib/states/illinoisTaxCalculator';
import { calculateNewYorkTax } from '@/lib/states/newYorkTaxCalculator';
import { calculateWashingtonTax } from '@/lib/states/washingtonTaxCalculator';
import { loadStateData, StateData, preloadStateData } from '@/lib/stateData';
import ConfigurationSection from './Forms/ConfigurationSection';
import DeductionInputs from './Forms/DeductionInputs';
import IncomeInputs from './Forms/IncomeInputs';
import PriorYearInputs from './Forms/PriorYearInputs';
import TaxResultsDisplay from './Displays/TaxResultsDisplay';
import WithholdingInputs from './Forms/WithholdingInputs';
import ErrorBoundary from './UI/ErrorBoundary';
import { formatCurrency } from '@/lib/formatters';
import FilingStatusComparisonModal, {
  SplitConfig,
  ScenarioResult,
  MFSScenarioResult,
} from './Modals/FilingStatusComparisonModal';

// Import federal data only (always needed) - these are small and required for all calculations
import allFederalBrackets from '@/data/federal-brackets.json';
import allFederalDeductions from '@/data/federal-deductions.json';
import allFederalLimits from '@/data/federal-limits.json';
import allFicaData from '@/data/fica.json';
import allSharedLimits from '@/data/limits.json';
import allLtcgBrackets from '@/data/federal-ltcg-brackets.json';

import { TAX_YEAR } from '@/lib/config';
const federalBrackets = allFederalBrackets[TAX_YEAR];
const federalDeductions = allFederalDeductions[TAX_YEAR];
const federalLimits = allFederalLimits[TAX_YEAR];
const ficaData = allFicaData[TAX_YEAR];
const sharedLimits = allSharedLimits[TAX_YEAR];
const ltcgBrackets = allLtcgBrackets[TAX_YEAR];

const defaultInputs: TaxInputs = {
  federalIncome: 0,
  stateIncome: 0,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  federalTaxWithheld: 0,
  stateTaxWithheld: 0,
  federalEstimatedPaid: 0,
  stateEstimatedPaid: 0,
  filingStatus: 'single',
  selectedState: 'california',
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
  federalTaxableIncome?: number
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
    case 'california':
      return calculateCaliforniaTax(inputs, brackets, deductions, sharedLimits, limits, ficaData);
    case 'colorado':
      return calculateColoradoTax(inputs, brackets, sharedLimits, limits, federalTaxableIncome ?? 0, ficaData);
    case 'dc':
      return calculateDCTax(inputs, brackets, deductions, sharedLimits, federalLimits, limits, ficaData);
    case 'florida':
      return calculateFloridaTax(inputs);
    case 'illinois':
      return calculateIllinoisTax(inputs, brackets, deductions, sharedLimits, limits, ficaData);
    case 'newyork':
      return calculateNewYorkTax(inputs, brackets, nycBrackets, deductions, sharedLimits, federalLimits, limits, ficaData);
    case 'washington':
    default:
      return calculateWashingtonTax(inputs, brackets, limits);
  }
}

export default function TaxCalculator() {
  const [inputs, setInputs] = useState<TaxInputs>(defaultInputs);
  const [isFilingCompareOpen, setIsFilingCompareOpen] = useState(false);
  const [loadedStateData, setLoadedStateData] = useState<Map<TaxState, StateData>>(new Map());
  const [isLoadingState, setIsLoadingState] = useState(true);

  // Load state data when selectedState changes
  useEffect(() => {
    const selectedState = inputs.selectedState;

    // If already loaded, no need to fetch
    if (loadedStateData.has(selectedState)) {
      setIsLoadingState(false);
      return;
    }

    setIsLoadingState(true);
    loadStateData(selectedState).then((data) => {
      setLoadedStateData((prev) => {
        const next = new Map(prev);
        next.set(selectedState, data);
        return next;
      });
      setIsLoadingState(false);
    });
  }, [inputs.selectedState, loadedStateData]);

  // Get the current state's data (may be undefined while loading)
  const currentStateData = loadedStateData.get(inputs.selectedState);

  const results: CalculationResults = useMemo(() => {
    const federal = calculateFederalTax(
      inputs,
      federalBrackets,
      ltcgBrackets,
      federalDeductions,
      sharedLimits,
      federalLimits,
      ficaData
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
            deductionUsed: 'standard' as const,
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

    const federalTaxableIncome = federal.taxableOrdinaryIncome + federal.taxableLTCG;
    const state = calculateStateTaxWithData(inputs, currentStateData, federalTaxableIncome);

    return { federal, state, selectedState: inputs.selectedState };
  }, [inputs, currentStateData]);

  const updateInput = <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  // Preload state data on hover for better UX
  const handleStateHover = useCallback((state: TaxState) => {
    preloadStateData(state);
  }, []);

  // Calculate federal tax scenario with different charitable contributions
  const calculateCharitableScenario = useCallback(
    (contributions: number) => {
      const modifiedInputs = { ...inputs, charitableContributions: contributions };
      const scenarioResult = calculateFederalTax(
        modifiedInputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData
      );
      return {
        totalTax: scenarioResult.totalTax,
        remainingOwed: scenarioResult.remainingOwed,
        effectiveRate: scenarioResult.grossIncome > 0
          ? scenarioResult.totalTax / scenarioResult.grossIncome
          : 0,
      };
    },
    [inputs]
  );

  // Extract federal results for the modal
  const federalResultsForModal = useMemo(() => ({
    totalTax: results.federal.totalTax,
    remainingOwed: results.federal.remainingOwed,
    effectiveRate: results.federal.grossIncome > 0
      ? results.federal.totalTax / results.federal.grossIncome
      : 0,
  }), [results.federal]);

  // Helper to calculate state tax for a given set of inputs (used by MFJ/MFS scenarios)
  const calculateStateForInputs = useCallback((stateInputs: TaxInputs) => {
    const stateData = loadedStateData.get(stateInputs.selectedState);
    if (!stateData) {
      // Return zero result if state data not loaded (shouldn't happen in practice)
      return {
        wageIncome: 0, shortTermCapitalGains: 0, longTermCapitalGains: 0, grossIncome: 0,
        adjustedGrossIncome: 0, taxableOrdinaryIncome: 0, taxableLTCG: 0, ordinaryIncomeTax: 0,
        ltcgTax: 0, ordinaryIncomeBracketBreakdown: [], ltcgBracketBreakdown: [],
        deductionBreakdown: { standardDeduction: 0, itemizedDeduction: 0, deductionAmount: 0,
          deductionUsed: 'standard' as const, saltDeduction: 0, saltCapped: false,
          mortgageInterest: 0, charitableContributions: 0 },
        totalTax: 0, withheld: 0, estimatedPaid: 0, totalPaid: 0, remainingOwed: 0, refundDue: 0,
        contributions401k: 0, preTaxMedical: 0, shortTermLossCarryoverOffset: 0, longTermLossCarryoverOffset: 0,
      };
    }
    const federalResult = calculateFederalTax(stateInputs, federalBrackets, ltcgBrackets, federalDeductions, sharedLimits, federalLimits, ficaData);
    return calculateStateTaxWithData(stateInputs, stateData, federalResult.taxableOrdinaryIncome + federalResult.taxableLTCG);
  }, [loadedStateData]);

  // Calculate MFJ scenario results for filing status comparison
  const mfjResults: ScenarioResult = useMemo(() => {
    const mfjInputs = { ...inputs, filingStatus: 'marriedFilingJointly' as const };
    const federal = calculateFederalTax(mfjInputs, federalBrackets, ltcgBrackets, federalDeductions, sharedLimits, federalLimits, ficaData);
    const state = calculateStateForInputs(mfjInputs);
    return {
      federalTax: federal.totalTax,
      stateTax: state.totalTax,
      totalTax: federal.totalTax + state.totalTax,
    };
  }, [inputs, calculateStateForInputs]);

  // Calculate MFS scenario with spouse splits
  const calculateMFSScenario = useCallback(
    (splits: SplitConfig): MFSScenarioResult => {
      // Build Spouse 1 inputs
      const spouse1Inputs: TaxInputs = {
        ...inputs,
        filingStatus: 'marriedFilingSeparately',
        federalIncome: inputs.federalIncome * (splits.wages / 100),
        stateIncome: inputs.stateIncome * (splits.wages / 100),
        selfEmploymentIncome: (inputs.selfEmploymentIncome || 0) * (splits.wages / 100),
        shortTermCapitalGains: inputs.shortTermCapitalGains * (splits.stcg / 100),
        longTermCapitalGains: inputs.longTermCapitalGains * (splits.ltcg / 100),
        contributions401k: inputs.contributions401k * (splits.contributions401k / 100),
        preTaxMedical: inputs.preTaxMedical * (splits.preTaxMedical / 100),
        mortgageInterestPaid: inputs.mortgageInterestPaid * (splits.deductions / 100),
        mortgageBalance: inputs.mortgageBalance * (splits.deductions / 100),
        propertyTaxesPaid: inputs.propertyTaxesPaid * (splits.deductions / 100),
        charitableContributions: inputs.charitableContributions * (splits.deductions / 100),
        priorYearShortTermLossCarryover: inputs.priorYearShortTermLossCarryover * (splits.stcg / 100),
        priorYearLongTermLossCarryover: inputs.priorYearLongTermLossCarryover * (splits.ltcg / 100),
        federalTaxWithheld: inputs.federalTaxWithheld * (splits.wages / 100),
        stateTaxWithheld: inputs.stateTaxWithheld * (splits.wages / 100),
        federalEstimatedPaid: inputs.federalEstimatedPaid * (splits.wages / 100),
        stateEstimatedPaid: inputs.stateEstimatedPaid * (splits.wages / 100),
        priorYearFederalTaxPaid: inputs.priorYearFederalTaxPaid * (splits.wages / 100),
        priorYearStateTaxPaid: inputs.priorYearStateTaxPaid * (splits.wages / 100),
      };

      // Build Spouse 2 inputs (inverse percentages)
      const spouse2Inputs: TaxInputs = {
        ...inputs,
        filingStatus: 'marriedFilingSeparately',
        federalIncome: inputs.federalIncome * ((100 - splits.wages) / 100),
        stateIncome: inputs.stateIncome * ((100 - splits.wages) / 100),
        selfEmploymentIncome: (inputs.selfEmploymentIncome || 0) * ((100 - splits.wages) / 100),
        shortTermCapitalGains: inputs.shortTermCapitalGains * ((100 - splits.stcg) / 100),
        longTermCapitalGains: inputs.longTermCapitalGains * ((100 - splits.ltcg) / 100),
        contributions401k: inputs.contributions401k * ((100 - splits.contributions401k) / 100),
        preTaxMedical: inputs.preTaxMedical * ((100 - splits.preTaxMedical) / 100),
        mortgageInterestPaid: inputs.mortgageInterestPaid * ((100 - splits.deductions) / 100),
        mortgageBalance: inputs.mortgageBalance * ((100 - splits.deductions) / 100),
        propertyTaxesPaid: inputs.propertyTaxesPaid * ((100 - splits.deductions) / 100),
        charitableContributions: inputs.charitableContributions * ((100 - splits.deductions) / 100),
        priorYearShortTermLossCarryover: inputs.priorYearShortTermLossCarryover * ((100 - splits.stcg) / 100),
        priorYearLongTermLossCarryover: inputs.priorYearLongTermLossCarryover * ((100 - splits.ltcg) / 100),
        federalTaxWithheld: inputs.federalTaxWithheld * ((100 - splits.wages) / 100),
        stateTaxWithheld: inputs.stateTaxWithheld * ((100 - splits.wages) / 100),
        federalEstimatedPaid: inputs.federalEstimatedPaid * ((100 - splits.wages) / 100),
        stateEstimatedPaid: inputs.stateEstimatedPaid * ((100 - splits.wages) / 100),
        priorYearFederalTaxPaid: inputs.priorYearFederalTaxPaid * ((100 - splits.wages) / 100),
        priorYearStateTaxPaid: inputs.priorYearStateTaxPaid * ((100 - splits.wages) / 100),
      };

      // Calculate each spouse's taxes
      const spouse1Federal = calculateFederalTax(spouse1Inputs, federalBrackets, ltcgBrackets, federalDeductions, sharedLimits, federalLimits, ficaData);
      const spouse1State = calculateStateForInputs(spouse1Inputs);
      const spouse2Federal = calculateFederalTax(spouse2Inputs, federalBrackets, ltcgBrackets, federalDeductions, sharedLimits, federalLimits, ficaData);
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
          totalTax: spouse1Federal.totalTax + spouse2Federal.totalTax + spouse1State.totalTax + spouse2State.totalTax,
        },
      };
    },
    [inputs, calculateStateForInputs]
  );

  const stateLabel = STATE_LABELS[inputs.selectedState];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#0f2439]">
          2025 Estimated Tax Calculator
        </h1>
        <p className="text-[#0f2439] mt-2">Federal & {stateLabel} Tax Estimation</p>
      </div>

      <div className="space-y-6">
        {/* Row 1: Config + Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConfigurationSection
            filingStatus={inputs.filingStatus}
            selectedState={inputs.selectedState}
            isNYCResident={inputs.isNYCResident}
            onFilingStatusChange={(status: FilingStatus) => updateInput('filingStatus', status)}
            onStateChange={(state: TaxState) => updateInput('selectedState', state)}
            onNYCResidentChange={(isNYC: boolean) => updateInput('isNYCResident', isNYC)}
            onCompareFilingStatus={() => setIsFilingCompareOpen(true)}
            onStateHover={handleStateHover}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {isLoadingState ? (
                <p className="text-2xl font-bold text-gray-400">Loading...</p>
              ) : results.state.remainingOwed > 0 ? (
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
        </div>

        {/* Row 2: Inputs + Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <IncomeInputs inputs={inputs} onUpdate={updateInput} />

            <WithholdingInputs inputs={inputs} onUpdate={updateInput} />

            <DeductionInputs
              inputs={inputs}
              onUpdate={updateInput}
              sharedLimits={sharedLimits}
              federalLimits={federalLimits}
              federalAgi={results.federal.adjustedGrossIncome}
              federalResults={federalResultsForModal}
              calculateCharitableScenario={calculateCharitableScenario}
            />

            <PriorYearInputs inputs={inputs} onUpdate={updateInput} />
          </div>

          <ErrorBoundary>
            <TaxResultsDisplay results={results} />
          </ErrorBoundary>
        </div>
      </div>

      <footer className="mt-8 text-center text-sm text-gray-600">
        <p>
          This calculator provides estimates only. Consult a tax professional for
          actual tax advice.
        </p>
      </footer>

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
