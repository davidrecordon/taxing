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

export default function WithholdingInputs({ inputs, onUpdate }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Tax Withheld & Estimated Payments</h2>

      <h3 className="text-md font-medium text-gray-900">Tax Withheld</h3>
      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Tax Withheld"
          value={inputs.federalTaxWithheld}
          onChange={(v) => onUpdate('federalTaxWithheld', v)}
          hint="From W-2/1099"
        />
        <CurrencyInput
          label="California Tax Withheld"
          value={inputs.californiaTaxWithheld}
          onChange={(v) => onUpdate('californiaTaxWithheld', v)}
          hint="From W-2/1099"
        />
      </div>

      <h3 className="text-md font-medium text-gray-900 pt-2">Estimated Taxes Already Paid</h3>
      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Estimated Paid"
          value={inputs.federalEstimatedPaid}
          onChange={(v) => onUpdate('federalEstimatedPaid', v)}
        />
        <CurrencyInput
          label="California Estimated Paid"
          value={inputs.californiaEstimatedPaid}
          onChange={(v) => onUpdate('californiaEstimatedPaid', v)}
        />
      </div>
    </div>
  );
}
