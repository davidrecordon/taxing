'use client';

import { useState, useMemo, useCallback } from 'react';
import { TaxInputs, FilingStatus, TaxState, CalculationResults, STATE_LABELS } from '@/lib/types';
import { calculateFederalTax } from '@/lib/federalTaxCalculator';
import { calculateCaliforniaTax } from '@/lib/states/californiaTaxCalculator';
import { calculateWashingtonTax } from '@/lib/states/washingtonTaxCalculator';
import { calculateNewYorkTax } from '@/lib/states/newYorkTaxCalculator';
import { calculateIllinoisTax } from '@/lib/states/illinoisTaxCalculator';
import ConfigurationSection from './ConfigurationSection';
import IncomeInputs from './IncomeInputs';
import WithholdingInputs from './WithholdingInputs';
import DeductionInputs from './DeductionInputs';
import PriorYearInputs from './PriorYearInputs';
import TaxResultsDisplay from './TaxResultsDisplay';
import ErrorBoundary from './ErrorBoundary';

// Import static data (multi-year files)
import allFederalBrackets from '@/data/federal-brackets.json';
import allLtcgBrackets from '@/data/federal-ltcg-brackets.json';
import allFederalDeductions from '@/data/federal-deductions.json';
import allCaliforniaBrackets from '@/data/california-brackets.json';
import allCaliforniaDeductions from '@/data/california-deductions.json';
import allWashingtonBrackets from '@/data/washington-brackets.json';
import allSharedLimits from '@/data/limits.json';
import allFederalLimits from '@/data/federal-limits.json';
import allCaliforniaLimits from '@/data/california-limits.json';
import allWashingtonLimits from '@/data/washington-limits.json';
import allNewYorkBrackets from '@/data/newyork-brackets.json';
import allNewYorkDeductions from '@/data/newyork-deductions.json';
import allNewYorkLimits from '@/data/newyork-limits.json';
import allNYCBrackets from '@/data/nyc-brackets.json';
import allIllinoisBrackets from '@/data/illinois-brackets.json';
import allIllinoisDeductions from '@/data/illinois-deductions.json';
import allIllinoisLimits from '@/data/illinois-limits.json';
import allFicaData from '@/data/fica.json';

import { TAX_YEAR } from '@/lib/config';
const federalBrackets = allFederalBrackets[TAX_YEAR];
const ltcgBrackets = allLtcgBrackets[TAX_YEAR];
const federalDeductions = allFederalDeductions[TAX_YEAR];
const californiaBrackets = allCaliforniaBrackets[TAX_YEAR];
const californiaDeductions = allCaliforniaDeductions[TAX_YEAR];
const washingtonBrackets = allWashingtonBrackets[TAX_YEAR];
const sharedLimits = allSharedLimits[TAX_YEAR];
const federalLimits = allFederalLimits[TAX_YEAR];
const californiaLimits = allCaliforniaLimits[TAX_YEAR];
const washingtonLimits = allWashingtonLimits[TAX_YEAR];
const newYorkBrackets = allNewYorkBrackets[TAX_YEAR];
const newYorkDeductions = allNewYorkDeductions[TAX_YEAR];
const newYorkLimits = allNewYorkLimits[TAX_YEAR];
const nycBrackets = allNYCBrackets[TAX_YEAR];
const illinoisBrackets = allIllinoisBrackets[TAX_YEAR];
const illinoisDeductions = allIllinoisDeductions[TAX_YEAR];
const illinoisLimits = allIllinoisLimits[TAX_YEAR];
const ficaData = allFicaData[TAX_YEAR];

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
};

export default function TaxCalculator() {
  const [inputs, setInputs] = useState<TaxInputs>(defaultInputs);

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
        state = calculateCaliforniaTax(inputs, californiaBrackets, californiaDeductions, sharedLimits, californiaLimits);
        break;
      case 'illinois':
        state = calculateIllinoisTax(inputs, illinoisBrackets, illinoisDeductions, sharedLimits, illinoisLimits);
        break;
      case 'newyork':
        state = calculateNewYorkTax(inputs, newYorkBrackets, nycBrackets, newYorkDeductions, sharedLimits, federalLimits, newYorkLimits);
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
    </div>
  );
}
