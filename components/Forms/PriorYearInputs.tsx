'use client';

import { TaxInputs, STATE_LABELS } from '@/lib/types';
import CurrencyInput from '../UI/CurrencyInput';

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
}

export default function PriorYearInputs({ inputs, onUpdate }: Props) {
  const stateLabel = STATE_LABELS[inputs.selectedState] || 'State';

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Prior Year</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Tax Paid"
          value={inputs.priorYearFederalTaxPaid}
          onChange={(v) => onUpdate('priorYearFederalTaxPaid', v)}
        />
        <CurrencyInput
          label={`${stateLabel} Tax Paid`}
          value={inputs.priorYearStateTaxPaid}
          onChange={(v) => onUpdate('priorYearStateTaxPaid', v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
