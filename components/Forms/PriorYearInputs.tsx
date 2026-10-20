"use client";

import { TaxInputs, STATE_LABELS } from "@/lib/types";
import CurrencyInput from "../UI/CurrencyInput";

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
}

export default function PriorYearInputs({ inputs, onUpdate }: Props) {
  const stateLabel = STATE_LABELS[inputs.selectedState] || "State";

  return (
    <div className="theme-card p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 font-display">
        Prior Year
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Last year's Federal tax"
          value={inputs.priorYearFederalTax}
          onChange={(v) => onUpdate("priorYearFederalTax", v)}
          hint="Total tax for the year, not what you paid at filing or your refund"
        />
        <CurrencyInput
          label={`Last year's ${stateLabel} tax`}
          value={inputs.priorYearStateTax}
          onChange={(v) => onUpdate("priorYearStateTax", v)}
          hint="Total tax for the year, not what you paid at filing or your refund"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Short-Term Loss Carryover"
          value={inputs.priorYearShortTermLossCarryover}
          onChange={(v) => onUpdate("priorYearShortTermLossCarryover", v)}
        />
        <CurrencyInput
          label="Long-Term Loss Carryover"
          value={inputs.priorYearLongTermLossCarryover}
          onChange={(v) => onUpdate("priorYearLongTermLossCarryover", v)}
        />
      </div>
    </div>
  );
}
