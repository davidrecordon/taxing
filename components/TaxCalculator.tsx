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

// Import static data
import federalBrackets from '@/data/federal-brackets-2025.json';
import ltcgBrackets from '@/data/federal-ltcg-brackets-2025.json';
import federalDeductions from '@/data/federal-deductions-2025.json';
import californiaBrackets from '@/data/california-brackets-2025.json';
import californiaDeductions from '@/data/california-deductions-2025.json';
import limits from '@/data/limits-2025.json';
import ficaData from '@/data/fica-2025.json';

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
        <p className="text-gray-700 mt-2">California + Federal Tax Estimation</p>
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
          <TaxResultsDisplay results={results} />
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
