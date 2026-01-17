"use client";

import { useId, useState } from "react";
import { parseNumericInput, formatNumberWithCommas } from "@/lib/formatters";

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  warning?: string;
  error?: string;
  allowNegative?: boolean;
}

// Format value for display, including negative sign if needed
function formatDisplayValue(val: number): string {
  if (val === 0) return "";
  const absValue = formatNumberWithCommas(String(Math.abs(val)));
  return val < 0 ? `-${absValue}` : absValue;
}

export default function CurrencyInput({
  label,
  value,
  onChange,
  hint,
  warning,
  error,
  allowNegative = false,
}: CurrencyInputProps) {
  const id = useId();

  const [inputValue, setInputValue] = useState(formatDisplayValue(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sync with external value changes during render (React recommended pattern)
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (value !== prevValue) {
    const numericValue = parseNumericInput(inputValue, allowNegative);
    if (value !== numericValue) {
      setInputValue(formatDisplayValue(value));
    }
    setPrevValue(value);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Check for negative sign at the start
    const hasNegative = allowNegative && raw.trimStart().startsWith("-");

    // Only allow digits, decimal point, and commas (strip minus for processing)
    const cleaned = raw.replace(/[^0-9.,]/g, "");

    // Prevent multiple decimal points
    const parts = cleaned.replace(/,/g, "").split(".");
    const validInput =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : cleaned.replace(/,/g, "");

    // Format with commas and add back negative sign if present
    const formattedValue = formatNumberWithCommas(validInput);
    const displayValue = hasNegative ? `-${formattedValue}` : formattedValue;
    setInputValue(displayValue);
    onChange(parseNumericInput(displayValue, allowNegative));
  };

  const isNegative = value < 0;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-primary mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <span
          className={`absolute left-3 top-2 ${isNegative ? "text-negative" : "text-text-muted"}`}
        >
          $
        </span>
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleChange}
          className={`theme-input w-full pl-7 pr-3 py-2 ${isNegative ? "text-negative" : ""}`}
          placeholder="0"
        />
      </div>
      {error && <p className="text-xs text-negative mt-1">{error}</p>}
      {warning && !error && (
        <p className="text-xs text-warning mt-1">{warning}</p>
      )}
      {hint && !error && !warning && (
        <p className="text-xs text-text-muted mt-1">{hint}</p>
      )}
    </div>
  );
}
