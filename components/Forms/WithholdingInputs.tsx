"use client";

import { TaxInputs, STATE_LABELS } from "@/lib/types";
import CurrencyInput from "../UI/CurrencyInput";

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
}

export default function WithholdingInputs({ inputs, onUpdate }: Props) {
  const stateLabel = STATE_LABELS[inputs.selectedState];

  return (
    <div className="theme-card p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 font-display">
        Tax Withheld & Estimated Payments
      </h2>

      <h3 className="text-md font-medium text-text-primary">Tax Withheld</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Tax Withheld"
          value={inputs.federalTaxWithheld}
          onChange={(v) => onUpdate("federalTaxWithheld", v)}
          hint="From W-2/1099"
        />
        <CurrencyInput
          label={`${stateLabel} Tax Withheld`}
          value={inputs.stateTaxWithheld}
          onChange={(v) => onUpdate("stateTaxWithheld", v)}
          hint="From W-2/1099"
        />
      </div>

      <h3 className="text-md font-medium text-text-primary pt-2">
        Estimated Taxes Already Paid
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Federal Estimated Paid"
          value={inputs.federalEstimatedPaid}
          onChange={(v) => onUpdate("federalEstimatedPaid", v)}
        />
        <CurrencyInput
          label={`${stateLabel} Estimated Paid`}
          value={inputs.stateEstimatedPaid}
          onChange={(v) => onUpdate("stateEstimatedPaid", v)}
        />
      </div>
    </div>
  );
}
