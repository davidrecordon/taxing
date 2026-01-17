import { memo } from "react";
import { BracketBreakdown } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";

interface BracketTableProps {
  /** Array of bracket breakdown data */
  breakdown: BracketBreakdown[];
  /** Title displayed above the table (e.g., "Ordinary Income Tax by Bracket") */
  title: string;
  /** Label for the income/gains column - defaults to "Income" */
  incomeLabel?: string;
  /** Label for the total row (e.g., "Ordinary Income Tax:" or "Capital Gains Tax:") */
  totalLabel: string;
  /** Total amount displayed in the footer */
  totalAmount: number;
  /** Optional footnote displayed below the table */
  footnote?: string;
}

/**
 * Reusable bracket table component for displaying tax calculations by bracket.
 * Used by Federal, California, Washington, and other state breakdown components.
 */
export default memo(function BracketTable({
  breakdown,
  title,
  incomeLabel = "Income",
  totalLabel,
  totalAmount,
  footnote,
}: BracketTableProps) {
  if (breakdown.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Bracket</th>
              <th className="text-right p-2">Rate</th>
              <th className="text-right p-2">{incomeLabel}</th>
              <th className="text-right p-2">Tax</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((bracket) => (
              <tr
                key={`${bracket.bracketMin}-${bracket.rate}`}
                className="border-b"
              >
                <td className="p-2">
                  {formatCurrency(bracket.bracketMin)} -{" "}
                  {bracket.bracketMax
                    ? formatCurrency(bracket.bracketMax)
                    : "..."}
                </td>
                <td className="text-right p-2">
                  {formatPercent(bracket.rate)}
                </td>
                <td className="text-right p-2 font-mono">
                  {formatCurrency(bracket.incomeInBracket)}
                </td>
                <td className="text-right p-2 font-mono">
                  {formatCurrency(bracket.taxForBracket)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-medium bg-gray-50">
            <tr>
              <td colSpan={3} className="p-2 text-right">
                {totalLabel}
              </td>
              <td className="p-2 text-right font-mono">
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {footnote && <p className="text-xs text-gray-500 mt-1">{footnote}</p>}
    </div>
  );
});
