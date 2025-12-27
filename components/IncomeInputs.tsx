'use client';

import { TaxInputs } from '@/lib/types';
import CurrencyInput from './CurrencyInput';

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
}

export default function IncomeInputs({ inputs, onUpdate }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Income</h2>

      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Income"
          value={inputs.federalIncome}
          onChange={(v) => onUpdate('federalIncome', v)}
        />
        <CurrencyInput
          label="California Income"
          value={inputs.californiaIncome}
          onChange={(v) => onUpdate('californiaIncome', v)}
          hint={inputs.californiaIncome ? undefined : "Leave blank to use Federal amount."}
        />
      </div>

      <h3 className="text-md font-medium text-gray-900 pt-2">Capital Gains</h3>
      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Short-Term Capital Gains"
          value={inputs.shortTermCapitalGains}
          onChange={(v) => onUpdate('shortTermCapitalGains', v)}
        />
        <CurrencyInput
          label="Long-Term Capital Gains"
          value={inputs.longTermCapitalGains}
          onChange={(v) => onUpdate('longTermCapitalGains', v)}
        />
      </div>

    </div>
  );
}
