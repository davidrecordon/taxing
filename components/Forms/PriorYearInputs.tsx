"use client";

import { formatCurrency } from "@/lib/formatters";
import { SharedLimitsData, STATE_LABELS, TaxInputs } from "@/lib/types";
import CurrencyInput from "../UI/CurrencyInput";

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
  sharedLimits: SharedLimitsData;
}

export default function PriorYearInputs({
  inputs,
  onUpdate,
  sharedLimits,
}: Props) {
  const stateLabel = STATE_LABELS[inputs.selectedState] || "State";

  // Sub-field: appears once a prior-year tax has been entered
  const showPriorYearIncome =
    inputs.priorYearFederalTax > 0 || inputs.priorYearStateTax > 0;
  // Sub-field: a balance paid this year for last year's state tax is part of
  // this year's Federal deduction for state taxes
  const stateTaxesIncome =
    inputs.selectedState !== "florida" && inputs.selectedState !== "washington";
  const showPriorYearStateBalance =
    stateTaxesIncome &&
    (inputs.priorYearStateTax > 0 || inputs.priorYearStateBalancePaid > 0);
  const highIncomeThreshold =
    inputs.filingStatus === "marriedFilingSeparately"
      ? sharedLimits.priorYearHighIncomeThreshold.marriedFilingSeparately
      : sharedLimits.priorYearHighIncomeThreshold.default;

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

      {showPriorYearStateBalance && (
        <CurrencyInput
          label={`${stateLabel} balance paid this year`}
          value={inputs.priorYearStateBalancePaid}
          onChange={(v) => onUpdate("priorYearStateBalancePaid", v)}
          hint="Paid this year with last year's return. Counts toward this year's Federal deduction."
        />
      )}

      {showPriorYearIncome && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.priorYearIncomeOverThreshold ?? true}
            onChange={(e) =>
              onUpdate("priorYearIncomeOverThreshold", e.target.checked)
            }
            className="w-4 h-4 accent-accent border-border rounded focus:ring-accent"
          />
          <span className="text-sm font-medium text-text-primary">
            Last year&apos;s income was over{" "}
            {formatCurrency(highIncomeThreshold)}
          </span>
          <span className="text-xs text-text-muted">
            (raises the share of last year&apos;s tax you need to have paid)
          </span>
        </label>
      )}

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
