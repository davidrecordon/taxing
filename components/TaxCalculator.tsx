'use client';

import { useState, useMemo, useCallback } from 'react';
import { TaxInputs, FilingStatus, TaxState, CalculationResults, STATE_LABELS } from '@/lib/types';
import { calculateFederalTax } from '@/lib/federalTaxCalculator';
import { calculateCaliforniaTax } from '@/lib/states/californiaTaxCalculator';
import { calculateColoradoTax } from '@/lib/states/coloradoTaxCalculator';
import { calculateDCTax } from '@/lib/states/dcTaxCalculator';
import { calculateFloridaTax } from '@/lib/states/floridaTaxCalculator';
import { calculateIllinoisTax } from '@/lib/states/illinoisTaxCalculator';
import { calculateNewYorkTax } from '@/lib/states/newYorkTaxCalculator';
import { calculateWashingtonTax } from '@/lib/states/washingtonTaxCalculator';
import ConfigurationSection from './Forms/ConfigurationSection';
import DeductionInputs from './Forms/DeductionInputs';
import IncomeInputs from './Forms/IncomeInputs';
import PriorYearInputs from './Forms/PriorYearInputs';
import TaxResultsDisplay from './Displays/TaxResultsDisplay';
import WithholdingInputs from './Forms/WithholdingInputs';
import ErrorBoundary from './UI/ErrorBoundary';
import FilingStatusComparisonModal, {
  SplitConfig,
  ScenarioResult,
  MFSScenarioResult,
} from './Modals/FilingStatusComparisonModal';

// Import static data (multi-year files)
import allCaliforniaBrackets from '@/data/california-brackets.json';
import allCaliforniaDeductions from '@/data/california-deductions.json';
import allCaliforniaLimits from '@/data/california-limits.json';
import allColoradoBrackets from '@/data/colorado-brackets.json';
import allColoradoLimits from '@/data/colorado-limits.json';
import allDCBrackets from '@/data/dc-brackets.json';
import allDCDeductions from '@/data/dc-deductions.json';
import allDCLimits from '@/data/dc-limits.json';
import allFederalBrackets from '@/data/federal-brackets.json';
import allFederalDeductions from '@/data/federal-deductions.json';
import allFederalLimits from '@/data/federal-limits.json';
import allFicaData from '@/data/fica.json';
import allFloridaBrackets from '@/data/florida-brackets.json';
import allFloridaLimits from '@/data/florida-limits.json';
import allIllinoisBrackets from '@/data/illinois-brackets.json';
import allIllinoisDeductions from '@/data/illinois-deductions.json';
import allIllinoisLimits from '@/data/illinois-limits.json';
import allSharedLimits from '@/data/limits.json';
import allLtcgBrackets from '@/data/federal-ltcg-brackets.json';
import allNewYorkBrackets from '@/data/newyork-brackets.json';
import allNewYorkDeductions from '@/data/newyork-deductions.json';
import allNewYorkLimits from '@/data/newyork-limits.json';
import allNYCBrackets from '@/data/nyc-brackets.json';
import allWashingtonBrackets from '@/data/washington-brackets.json';
import allWashingtonLimits from '@/data/washington-limits.json';

import { TAX_YEAR } from '@/lib/config';
const californiaBrackets = allCaliforniaBrackets[TAX_YEAR];
const californiaDeductions = allCaliforniaDeductions[TAX_YEAR];
const californiaLimits = allCaliforniaLimits[TAX_YEAR];
const coloradoBrackets = allColoradoBrackets[TAX_YEAR];
const coloradoLimits = allColoradoLimits[TAX_YEAR];
const dcBrackets = allDCBrackets[TAX_YEAR];
const dcDeductions = allDCDeductions[TAX_YEAR];
const dcLimits = allDCLimits[TAX_YEAR];
const federalBrackets = allFederalBrackets[TAX_YEAR];
const federalDeductions = allFederalDeductions[TAX_YEAR];
const federalLimits = allFederalLimits[TAX_YEAR];
const ficaData = allFicaData[TAX_YEAR];
const floridaBrackets = allFloridaBrackets[TAX_YEAR];
const floridaLimits = allFloridaLimits[TAX_YEAR];
const illinoisBrackets = allIllinoisBrackets[TAX_YEAR];
const illinoisDeductions = allIllinoisDeductions[TAX_YEAR];
const illinoisLimits = allIllinoisLimits[TAX_YEAR];
const ltcgBrackets = allLtcgBrackets[TAX_YEAR];
const newYorkBrackets = allNewYorkBrackets[TAX_YEAR];
const newYorkDeductions = allNewYorkDeductions[TAX_YEAR];
const newYorkLimits = allNewYorkLimits[TAX_YEAR];
const nycBrackets = allNYCBrackets[TAX_YEAR];
const sharedLimits = allSharedLimits[TAX_YEAR];
const washingtonBrackets = allWashingtonBrackets[TAX_YEAR];
const washingtonLimits = allWashingtonLimits[TAX_YEAR];

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

export default function TaxCalculator() {
  const [inputs, setInputs] = useState<TaxInputs>(defaultInputs);
  const [isFilingCompareOpen, setIsFilingCompareOpen] = useState(false);

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

    let state;
    switch (inputs.selectedState) {
      case 'california':
        state = calculateCaliforniaTax(inputs, californiaBrackets, californiaDeductions, sharedLimits, californiaLimits, ficaData);
        break;
      case 'colorado':
        state = calculateColoradoTax(inputs, coloradoBrackets, sharedLimits, coloradoLimits, federal.taxableOrdinaryIncome + federal.taxableLTCG, ficaData);
        break;
      case 'dc':
        state = calculateDCTax(inputs, dcBrackets, dcDeductions, sharedLimits, federalLimits, dcLimits, ficaData);
        break;
      case 'florida':
        state = calculateFloridaTax(inputs);
        break;
      case 'illinois':
        state = calculateIllinoisTax(inputs, illinoisBrackets, illinoisDeductions, sharedLimits, illinoisLimits, ficaData);
        break;
      case 'newyork':
        state = calculateNewYorkTax(inputs, newYorkBrackets, nycBrackets, newYorkDeductions, sharedLimits, federalLimits, newYorkLimits, ficaData);
        break;
      case 'washington':
      default:
        state = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);
    }

    return { federal, state, selectedState: inputs.selectedState };
  }, [inputs]);

  const updateInput = <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

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

  // Helper to calculate state tax for a given set of inputs
  const calculateStateForInputs = useCallback((stateInputs: TaxInputs) => {
    switch (stateInputs.selectedState) {
      case 'california':
        return calculateCaliforniaTax(stateInputs, californiaBrackets, californiaDeductions, sharedLimits, californiaLimits, ficaData);
      case 'colorado': {
        // Colorado needs federal taxable income, so calculate federal first
        const federalResult = calculateFederalTax(stateInputs, federalBrackets, ltcgBrackets, federalDeductions, sharedLimits, federalLimits, ficaData);
        return calculateColoradoTax(stateInputs, coloradoBrackets, sharedLimits, coloradoLimits, federalResult.taxableOrdinaryIncome + federalResult.taxableLTCG, ficaData);
      }
      case 'dc':
        return calculateDCTax(stateInputs, dcBrackets, dcDeductions, sharedLimits, federalLimits, dcLimits, ficaData);
      case 'florida':
        return calculateFloridaTax(stateInputs);
      case 'illinois':
        return calculateIllinoisTax(stateInputs, illinoisBrackets, illinoisDeductions, sharedLimits, illinoisLimits, ficaData);
      case 'newyork':
        return calculateNewYorkTax(stateInputs, newYorkBrackets, nycBrackets, newYorkDeductions, sharedLimits, federalLimits, newYorkLimits, ficaData);
      case 'washington':
      default:
        return calculateWashingtonTax(stateInputs, washingtonBrackets, washingtonLimits);
    }
  }, []);

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
        // Split loss carryovers proportionally to capital gains
        priorYearShortTermLossCarryover: inputs.priorYearShortTermLossCarryover * (splits.stcg / 100),
        priorYearLongTermLossCarryover: inputs.priorYearLongTermLossCarryover * (splits.ltcg / 100),
        // Withholding/payments - assume proportional to wages
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Inputs */}
        <div className="space-y-6">
          <ConfigurationSection
            filingStatus={inputs.filingStatus}
            selectedState={inputs.selectedState}
            isNYCResident={inputs.isNYCResident}
            onFilingStatusChange={(status: FilingStatus) => updateInput('filingStatus', status)}
            onStateChange={(state: TaxState) => updateInput('selectedState', state)}
            onNYCResidentChange={(isNYC: boolean) => updateInput('isNYCResident', isNYC)}
            onCompareFilingStatus={() => setIsFilingCompareOpen(true)}
          />

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

        {/* Right Column: Results */}
        <div className="space-y-6">
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
