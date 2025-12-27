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
  warning,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  warning?: string;
  error?: string;
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
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {warning && !error && <p className="text-xs text-amber-600 mt-1">{warning}</p>}
      {hint && !error && !warning && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function PriorYearInputs({ inputs, onUpdate }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Prior Year</h2>

      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Tax Paid"
          value={inputs.priorYearFederalTaxPaid}
          onChange={(v) => onUpdate('priorYearFederalTaxPaid', v)}
        />
        <CurrencyInput
          label="California Tax Paid"
          value={inputs.priorYearCaliforniaTaxPaid}
          onChange={(v) => onUpdate('priorYearCaliforniaTaxPaid', v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Short-Term Loss Carryover"
          value={inputs.priorYearShortTermLossCarryover}
          onChange={(v) => onUpdate('priorYearShortTermLossCarryover', v)}
          hint="Will not be used to offset long-term gains."
        />
        <CurrencyInput
          label="Long-Term Loss Carryover"
          value={inputs.priorYearLongTermLossCarryover}
          onChange={(v) => onUpdate('priorYearLongTermLossCarryover', v)}
        />
      </div>
    </div>
  );
}
