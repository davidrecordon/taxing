'use client';

import { TaxInputs } from '@/lib/types';
import { parseNumericInput } from '@/lib/formatters';

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
}

function CurrencyInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-gray-600">$</span>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(parseNumericInput(e.target.value))}
          className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="0"
        />
      </div>
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
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
          hint={inputs.californiaIncome ? undefined : "Leave blank to use Federal amount"}
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
