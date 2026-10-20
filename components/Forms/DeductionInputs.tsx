"use client";

import { useState } from "react";
import { TaxInputs, SharedLimitsData, FederalLimitsData } from "@/lib/types";
import { calculateSaltLimit } from "@/lib/deductionCalculator";
import { formatCurrency } from "@/lib/formatters";
import CurrencyInput from "../UI/CurrencyInput";
import CharitableWhatIfModal from "../Modals/CharitableWhatIfModal";

interface ScenarioResult {
  totalTax: number;
  remainingOwed: number;
  refundDue: number;
  effectiveRate: number;
}

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
  sharedLimits: SharedLimitsData;
  federalLimits: FederalLimitsData;
  federalAgi?: number;
  federalResults?: ScenarioResult;
  calculateCharitableScenario?: (contributions: number) => ScenarioResult;
}

export default function DeductionInputs({
  inputs,
  onUpdate,
  sharedLimits,
  federalLimits,
  federalAgi,
  federalResults,
  calculateCharitableScenario,
}: Props) {
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);

  // SALT limit phases down as AGI rises above the threshold
  const applicableSaltLimit = calculateSaltLimit(
    inputs.filingStatus,
    federalLimits,
    federalAgi ?? 0,
  );

  // Generate SALT warning message
  const getSaltWarning = (): string | undefined => {
    if (inputs.propertyTaxesPaid <= applicableSaltLimit) {
      return undefined;
    }
    return `Will be limited to the ${formatCurrency(applicableSaltLimit)} Federal SALT deduction.`;
  };

  // Federal mortgage limits: loans from before December 16, 2017 keep the
  // older, higher limit
  const isSeparate = inputs.filingStatus === "marriedFilingSeparately";
  const standardMortgageLimit = isSeparate
    ? federalLimits.mortgageBalanceLimit.marriedFilingSeparately
    : federalLimits.mortgageBalanceLimit.default;
  const grandfatheredMortgageLimit = isSeparate
    ? federalLimits.grandfatheredMortgageBalanceLimit.marriedFilingSeparately
    : federalLimits.grandfatheredMortgageBalanceLimit.default;
  const applicableMortgageLimit = inputs.isMortgageGrandfathered
    ? grandfatheredMortgageLimit
    : standardMortgageLimit;

  const contribution401kLimit =
    inputs.filingStatus === "marriedFilingJointly"
      ? sharedLimits.contribution401k.standard * 2
      : sharedLimits.contribution401k.standard;

  return (
    <div className="theme-card p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2 font-display">
        Deductions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="401(k) Pre-Tax Contributions"
          value={inputs.contributions401k}
          onChange={(v) => onUpdate("contributions401k", v)}
          error={
            inputs.contributions401k > contribution401kLimit
              ? `Exceeds ${inputs.taxYear} limit of ${formatCurrency(contribution401kLimit)}.`
              : undefined
          }
        />
        <CurrencyInput
          label="Pre-Tax Medical"
          value={inputs.preTaxMedical}
          onChange={(v) => onUpdate("preTaxMedical", v)}
          hint="HSA/FSA and insurance"
        />
      </div>

      <h3 className="text-md font-medium text-text-primary pt-2">
        Itemized Deduction Items
      </h3>

      <CurrencyInput
        label="Property Taxes Paid"
        value={inputs.propertyTaxesPaid}
        onChange={(v) => onUpdate("propertyTaxesPaid", v)}
        warning={getSaltWarning()}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CurrencyInput
          label="Mortgage Interest Paid"
          value={inputs.mortgageInterestPaid}
          onChange={(v) => onUpdate("mortgageInterestPaid", v)}
          hint="Fully deducted if balance is blank. Otherwise prorated based on limits."
        />
        <CurrencyInput
          label="Mortgage Balance"
          value={inputs.mortgageBalance}
          onChange={(v) => onUpdate("mortgageBalance", v)}
          hint="Average balance across the year."
          warning={
            inputs.mortgageBalance > applicableMortgageLimit
              ? `Interest deduction will be prorated based on mortgage limits.`
              : undefined
          }
        />
      </div>

      {inputs.mortgageBalance > standardMortgageLimit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inputs.isMortgageGrandfathered ?? false}
            onChange={(e) =>
              onUpdate("isMortgageGrandfathered", e.target.checked)
            }
            className="w-4 h-4 accent-accent border-border rounded focus:ring-accent"
          />
          <span className="text-sm font-medium text-text-primary">
            Loan is from before December 16, 2017
          </span>
          <span className="text-xs text-text-muted">
            (uses the older {formatCurrency(grandfatheredMortgageLimit)} Federal
            limit)
          </span>
        </label>
      )}

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <CurrencyInput
            label="Charitable Contributions"
            value={inputs.charitableContributions}
            onChange={(v) => onUpdate("charitableContributions", v)}
          />
        </div>
        {federalResults && calculateCharitableScenario && (
          <button
            onClick={() => setIsWhatIfOpen(true)}
            className="px-4 py-2 bg-accent-subtle text-accent text-sm font-medium rounded-[var(--radius-md)] hover:bg-[var(--color-accent)] hover:text-white transition-colors whitespace-nowrap"
          >
            What if...
          </button>
        )}
      </div>

      {federalResults && calculateCharitableScenario && (
        <CharitableWhatIfModal
          isOpen={isWhatIfOpen}
          onClose={() => setIsWhatIfOpen(false)}
          currentContributions={inputs.charitableContributions}
          federalAgi={federalAgi ?? 0}
          currentResults={federalResults}
          calculateScenario={calculateCharitableScenario}
          onApply={(value) => onUpdate("charitableContributions", value)}
        />
      )}
    </div>
  );
}
