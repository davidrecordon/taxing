"use client";

import {
  CharitableScenario,
  compareWithNoGiving,
} from "@/lib/charitableScenario";
import { formatCurrency } from "@/lib/formatters";
import Dialog from "../UI/Dialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentContributions: number;
  federalAgi: number;
  stateLabel: string;
  calculateScenario: (contributions: number) => CharitableScenario;
  onApply: (contributions: number) => void;
}

// Above this share of income the percentage limits on charitable deductions
// can apply (30% for appreciated assets, 60% for cash)
const LARGE_GIFT_SHARE_OF_INCOME = 0.3;

export default function CharitableWhatIfModal({
  isOpen,
  onClose,
  currentContributions,
  federalAgi,
  stateLabel,
  calculateScenario,
  onApply,
}: Props) {
  if (!isOpen) return null;

  const scenarios = [
    {
      label: "Half",
      value: Math.round(currentContributions / 2),
      isCurrent: false,
    },
    { label: "Current", value: currentContributions, isCurrent: true },
    { label: "Double", value: currentContributions * 2, isCurrent: false },
  ];

  // Each scenario is compared with giving nothing, so every row answers
  // "what does giving this much save?"
  const noGiving = calculateScenario(0);
  const rows = scenarios.map((scenario) => {
    const result = calculateScenario(scenario.value);
    return {
      ...scenario,
      result,
      saving: compareWithNoGiving(noGiving, result),
    };
  });
  const largestRow = rows[rows.length - 1];

  // Name the state, and split each saving, only where there is state tax for
  // a gift to change
  const hasStateTax = noGiving.stateTax > 0;
  const taxesCovered = hasStateTax ? `Federal and ${stateLabel}` : "Federal";

  // What the second half of a doubled gift saves on its own
  const currentRow = rows.find((row) => row.isCurrent) ?? largestRow;
  const extraGift = largestRow.value - currentRow.value;
  const extraSaved =
    largestRow.saving.totalSaved - currentRow.saving.totalSaved;
  const doublingSummary =
    extraSaved > 0
      ? `Doubling your gift saves a further ${formatCurrency(extraSaved)}, so the extra ${formatCurrency(extraGift)} costs ${formatCurrency(extraGift - extraSaved)} after tax (${Math.round(((extraGift - extraSaved) / extraGift) * 100)}¢ per $1).`
      : "Doubling your gift saves no further tax.";

  // Notes on what is limiting the saving
  const notes: string[] = [];
  if (largestRow.result.federalFloor > 0) {
    notes.push(
      `The first ${formatCurrency(largestRow.result.federalFloor)} of giving each year is not deductible federally.`,
    );
  }
  if (
    rows.some(
      (row) =>
        row.result.standardChosenForStateTax && row.saving.totalSaved === 0,
    )
  ) {
    notes.push(
      `Where there is no saving, taking the standard deduction is still better for your Federal and ${stateLabel} tax combined.`,
    );
  } else if (rows.some((row) => !row.result.federalItemizes)) {
    notes.push(
      "Where there is no Federal saving, the standard deduction is still larger than your itemized deductions.",
    );
  }
  if (rows.some((row) => row.saving.federalLimitGrew)) {
    notes.push(
      "Part of each gift is lost to the Federal limit on itemized deductions for top-bracket income.",
    );
  }
  if (rows.some((row) => row.saving.stateLimitGrew)) {
    notes.push(
      `${stateLabel} allows only part of each gift at your income, which lowers the state saving.`,
    );
  }
  if (rows.some((row) => row.saving.stateSaved < 0)) {
    notes.push(
      `A gift that makes itemizing worthwhile can raise ${stateLabel} tax while lowering the total.`,
    );
  } else if (
    noGiving.stateTax > 0 &&
    rows.every((row) => row.saving.stateSaved === 0) &&
    largestRow.saving.federalSaved > 0
  ) {
    notes.push(`These gifts do not change your ${stateLabel} tax.`);
  }
  if (
    federalAgi > 0 &&
    rows.some((row) => row.value > federalAgi * LARGE_GIFT_SHARE_OF_INCOME)
  ) {
    notes.push(
      "Gifts above 30% of income (60% for cash) may not be fully deductible in one year; the rest carries forward. That limit is not applied here.",
    );
  }
  notes.push(
    "Donating appreciated investments also avoids tax on the gain, which is not included here.",
  );

  // A negative amount means the gift raises that tax
  const formatSaved = (amount: number) => {
    if (amount > 0) {
      return <span className="text-positive">{formatCurrency(amount)}</span>;
    }
    if (amount < 0) {
      return <span className="text-negative">-{formatCurrency(-amount)}</span>;
    }
    return <span className="text-text-muted">{formatCurrency(0)}</span>;
  };

  const handleApply = (value: number) => {
    onApply(value);
    onClose();
  };

  return (
    <Dialog title="Charitable Contributions: What If?" onClose={onClose}>
      {/* Info text */}
      <p className="text-sm text-text-secondary mb-4">
        What giving saves in {taxesCovered} tax, and what each gift costs
        you after that saving. Savings are compared with giving nothing.
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-medium text-text-primary">
                Scenario
              </th>
              <th className="text-right py-2 px-2 font-medium text-text-primary">
                Gift
              </th>
              <th className="text-right py-2 px-2 font-medium text-text-primary">
                Tax Saved
              </th>
              <th className="text-right py-2 px-2 font-medium text-text-primary">
                Cost After Tax
              </th>
              <th className="py-2 px-2">
                <span className="sr-only">Use this amount</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { federalSaved, stateSaved, totalSaved } = row.saving;
              const costAfterTax = row.value - totalSaved;

              return (
                <tr
                  key={row.label}
                  className={`border-b border-border align-top ${
                    row.isCurrent
                      ? "bg-accent-subtle"
                      : "hover:bg-secondary"
                  } transition-colors`}
                >
                  <td className="py-3 px-2 font-medium text-text-primary">
                    {row.label}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-text-secondary">
                    {formatCurrency(row.value)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="font-mono font-medium">
                      {formatSaved(totalSaved)}
                    </div>
                    {hasStateTax && totalSaved !== 0 && (
                      <div className="text-xs text-text-muted">
                        Federal {formatSaved(federalSaved)}, State{" "}
                        {formatSaved(stateSaved)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="font-mono font-medium text-text-primary">
                      {formatCurrency(costAfterTax)}
                    </div>
                    {row.value > 0 && (
                      <div className="text-xs text-text-muted">
                        {Math.round((costAfterTax / row.value) * 100)}¢
                        per $1 given
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {!row.isCurrent && (
                      <button
                        onClick={() => handleApply(row.value)}
                        aria-label={`Use ${formatCurrency(row.value)}`}
                        className="theme-button-primary px-3 py-1 text-xs"
                      >
                        Apply
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* What doubling adds, compared with the current gift */}
      <p className="mt-3 text-sm text-text-secondary">
        {doublingSummary}
      </p>

      {/* Notes on what limits the saving */}
      <ul className="mt-3 space-y-1 text-xs text-text-muted list-disc pl-4">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </Dialog>
  );
}
