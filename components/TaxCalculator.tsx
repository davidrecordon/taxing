'use client';

import { useState, useMemo } from 'react';
import { TaxInputs, FilingStatus, CalculationResults } from '@/lib/types';
import { calculateFederalTax } from '@/lib/federalTaxCalculator';
import { calculateCaliforniaTax } from '@/lib/californiaTaxCalculator';
import FilingStatusSelect from './FilingStatusSelect';
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
import allLimits from '@/data/limits.json';
import allFicaData from '@/data/fica.json';

import { TAX_YEAR } from '@/lib/config';
const federalBrackets = allFederalBrackets[TAX_YEAR];
const ltcgBrackets = allLtcgBrackets[TAX_YEAR];
const federalDeductions = allFederalDeductions[TAX_YEAR];
const californiaBrackets = allCaliforniaBrackets[TAX_YEAR];
const californiaDeductions = allCaliforniaDeductions[TAX_YEAR];
const limits = allLimits[TAX_YEAR];
const ficaData = allFicaData[TAX_YEAR];

const defaultInputs: TaxInputs = {
  federalIncome: 0,
  californiaIncome: 0,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  federalTaxWithheld: 0,
  californiaTaxWithheld: 0,
  federalEstimatedPaid: 0,
  californiaEstimatedPaid: 0,
  filingStatus: 'single',
  propertyTaxesPaid: 0,
  mortgageInterestPaid: 0,
  mortgageBalance: 0,
  charitableContributions: 0,
  contributions401k: 0,
  priorYearFederalTaxPaid: 0,
  priorYearCaliforniaTaxPaid: 0,
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
      limits,
      ficaData
    );
    const california = calculateCaliforniaTax(
      inputs,
      californiaBrackets,
      californiaDeductions,
      limits
    );
    return { federal, california };
  }, [inputs]);

  const updateInput = <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          2025 Estimated Tax Calculator
        </h1>
        <p className="text-gray-700 mt-2">Federal & California Tax Estimation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Inputs */}
        <div className="space-y-6">
          <FilingStatusSelect
            value={inputs.filingStatus}
            onChange={(status: FilingStatus) => updateInput('filingStatus', status)}
          />

          <IncomeInputs inputs={inputs} onUpdate={updateInput} />

          <WithholdingInputs inputs={inputs} onUpdate={updateInput} />

          <DeductionInputs inputs={inputs} onUpdate={updateInput} limits={limits} />

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
