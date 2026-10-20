"use client";

import { formatCurrency } from "@/lib/formatters";
import { SharedLimitsData, STATE_LABELS, TaxInputs } from "@/lib/types";
import CurrencyInput from "../UI/CurrencyInput";

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
  sharedLimits: SharedLimitsData;
}

export default function IncomeInputs({
  inputs,
  onUpdate,
  sharedLimits,
}: Props) {
  const stateLabel = STATE_LABELS[inputs.selectedState] || "State";

  // Annual capital loss deduction depends on filing status
  const capitalLossLimit = formatCurrency(
    inputs.filingStatus === "marriedFilingSeparately"
      ? sharedLimits.capitalLossLimit.marriedFilingSeparately
      : sharedLimits.capitalLossLimit.default,
  );

  // Sub-fields appear once their parent has a value, and never hide while
  // they hold a value of their own
  // Treasury interest only matters where the state taxes income
  const stateTaxesIncome =
    inputs.selectedState !== "florida" && inputs.selectedState !== "washington";
  const showTreasuryInterest =
    stateTaxesIncome &&
    (inputs.interestIncome > 0 || inputs.treasuryInterest > 0);
  const showQualifiedDividends =
    inputs.ordinaryDividends > 0 || inputs.qualifiedDividends > 0;

  return (
    <div className="theme-card p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 font-display">
        Income
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Wages & Other Income"
          value={inputs.federalIncome}
          onChange={(v) => onUpdate("federalIncome", v)}
          hint="W-2 wages, before 401(k) and other pre-tax deductions"
        />
        <CurrencyInput
          label={`${stateLabel} Income`}
          value={inputs.stateIncome}
          onChange={(v) => onUpdate("stateIncome", v)}
          hint={
            inputs.stateIncome
              ? undefined
              : "Leave blank to use Federal amount."
          }
        />
      </div>

      <CurrencyInput
        label="Self-Employment Income"
        value={inputs.selfEmploymentIncome}
        onChange={(v) => onUpdate("selfEmploymentIncome", v)}
        hint="Freelance, contractor or gig economy income"
      />

      <h3 className="text-md font-medium text-text-primary pt-2">
        Interest & Dividends
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Interest"
          value={inputs.interestIncome}
          onChange={(v) => onUpdate("interestIncome", v)}
          hint="Taxable interest from savings, CDs and bonds"
        />
        {showTreasuryInterest && (
          <CurrencyInput
            label="Of which U.S. Treasury"
            value={inputs.treasuryInterest}
            onChange={(v) => onUpdate("treasuryInterest", v)}
            hint={`Treasury bills, notes and bonds. Not taxed by ${stateLabel}.`}
            warning={
              inputs.treasuryInterest > inputs.interestIncome
                ? "Cannot exceed interest. The excess is ignored."
                : undefined
            }
          />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Ordinary Dividends"
          value={inputs.ordinaryDividends}
          onChange={(v) => onUpdate("ordinaryDividends", v)}
          hint="All dividends for the year, including qualified"
        />
        {showQualifiedDividends && (
          <CurrencyInput
            label="Qualified Dividends"
            value={inputs.qualifiedDividends}
            onChange={(v) => onUpdate("qualifiedDividends", v)}
            hint="The portion taxed at long-term rates"
            warning={
              inputs.qualifiedDividends > inputs.ordinaryDividends
                ? "Cannot exceed ordinary dividends. The excess is ignored."
                : undefined
            }
          />
        )}
      </div>

      <h3 className="text-md font-medium text-text-primary pt-2">
        Capital Gains
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Short-Term Capital Gains"
          value={inputs.shortTermCapitalGains}
          onChange={(v) => onUpdate("shortTermCapitalGains", v)}
          allowNegative={true}
          warning={
            inputs.shortTermCapitalGains < 0
              ? `Losses offset long-term gains, then up to ${capitalLossLimit} of other income.`
              : undefined
          }
        />
        <CurrencyInput
          label="Long-Term Capital Gains"
          value={inputs.longTermCapitalGains}
          onChange={(v) => onUpdate("longTermCapitalGains", v)}
          allowNegative={true}
          warning={
            inputs.longTermCapitalGains < 0
              ? `Losses offset short-term gains, then up to ${capitalLossLimit} of other income.`
              : undefined
          }
        />
      </div>
    </div>
  );
}
