'use client';

import { TaxInputs, SharedLimitsData, FederalLimitsData } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import CurrencyInput from './CurrencyInput';

interface Props {
  inputs: TaxInputs;
  onUpdate: <K extends keyof TaxInputs>(field: K, value: TaxInputs[K]) => void;
  sharedLimits: SharedLimitsData;
  federalLimits: FederalLimitsData;
}

export default function DeductionInputs({ inputs, onUpdate, sharedLimits, federalLimits }: Props) {
  // Calculate rough pre-deduction AGI to determine applicable SALT limit
  const roughAgi = inputs.federalIncome + inputs.shortTermCapitalGains + inputs.longTermCapitalGains - inputs.contributions401k;

  // Select SALT limit based on AGI threshold
  const applicableSaltLimit = roughAgi < federalLimits.saltLimit.elevatedAgiThreshold
    ? federalLimits.saltLimit.elevated[inputs.filingStatus]
    : (inputs.filingStatus === 'marriedFilingSeparately'
        ? federalLimits.saltLimit.marriedFilingSeparately
        : federalLimits.saltLimit.default);

  // Generate SALT warning message
  const getSaltWarning = (): string | undefined => {
    if (inputs.propertyTaxesPaid <= applicableSaltLimit) {
      return undefined;
    }
    return `Will be limited to the ${formatCurrency(applicableSaltLimit)} Federal SALT deduction.`;
  };

  const contribution401kLimit =
    inputs.filingStatus === 'marriedFilingJointly'
      ? sharedLimits.contribution401k.standard * 2
      : sharedLimits.contribution401k.standard;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Deductions</h2>

      <CurrencyInput
        label="401(k) Pre-Tax Contributions"
        value={inputs.contributions401k}
        onChange={(v) => onUpdate('contributions401k', v)}
        error={inputs.contributions401k > contribution401kLimit
          ? `Exceeds 2025 limit of ${formatCurrency(contribution401kLimit)}.`
          : undefined}
      />

      <h3 className="text-md font-medium text-gray-900 pt-2">Itemized Deduction Items</h3>

      <CurrencyInput
        label="Property / Local Taxes Paid"
        value={inputs.propertyTaxesPaid}
        onChange={(v) => onUpdate('propertyTaxesPaid', v)}
        warning={getSaltWarning()}
      />

      <div className="grid grid-cols-2 gap-4">
        <CurrencyInput
          label="Mortgage Interest Paid"
          value={inputs.mortgageInterestPaid}
          onChange={(v) => onUpdate('mortgageInterestPaid', v)}
          hint="Fully deducted if balance is blank. Otherwise prorated based on limits."
        />
        <CurrencyInput
          label="Mortgage Balance"
          value={inputs.mortgageBalance}
          onChange={(v) => onUpdate('mortgageBalance', v)}
          hint="Average balance across the year."
          warning={inputs.mortgageBalance > (
            inputs.filingStatus === 'marriedFilingSeparately'
              ? federalLimits.mortgageBalanceLimit.marriedFilingSeparately
              : federalLimits.mortgageBalanceLimit.default
          )
            ? `Interest deduction will be prorated to meet Federal and California limits.`
            : undefined}
        />
      </div>

      <CurrencyInput
        label="Charitable Contributions"
        value={inputs.charitableContributions}
        onChange={(v) => onUpdate('charitableContributions', v)}
      />

    </div>
  );
}
