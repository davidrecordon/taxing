'use client';

import { TaxInputs, STATE_LABELS } from '@/lib/types';
import CurrencyInput from './CurrencyInput';

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
}

export default function IncomeInputs({ inputs, onUpdate }: Props) {
  const stateLabel = STATE_LABELS[inputs.selectedState] || 'State';

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
          label={`${stateLabel} Income`}
          value={inputs.stateIncome}
          onChange={(v) => onUpdate('stateIncome', v)}
          hint={inputs.stateIncome ? undefined : "Leave blank to use Federal amount."}
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
          allowNegative={true}
          warning={inputs.longTermCapitalGains < 0 ? "Long-term capital losses will be carried over to next year." : undefined}
        />
      </div>

    </div>
  );
}
