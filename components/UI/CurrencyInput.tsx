'use client';

import { useId, useState, useEffect } from 'react';
import { parseNumericInput, formatNumberWithCommas } from '@/lib/formatters';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  warning?: string;
  error?: string;
  allowNegative?: boolean;
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

  // Format value for display, including negative sign if needed
  const formatDisplayValue = (val: number): string => {
    if (val === 0) return '';
    const absValue = formatNumberWithCommas(String(Math.abs(val)));
    return val < 0 ? `-${absValue}` : absValue;
  };

  const [inputValue, setInputValue] = useState(formatDisplayValue(value));

  // Sync with external value changes (e.g., form reset)
  useEffect(() => {
    setInputValue((current) => {
      const numericValue = parseNumericInput(current, allowNegative);
      if (value !== numericValue) {
        return formatDisplayValue(value);
      }
      return current;
    });
  }, [value, allowNegative]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Check for negative sign at the start
    const hasNegative = allowNegative && raw.trimStart().startsWith('-');

    // Only allow digits, decimal point, and commas (strip minus for processing)
    const cleaned = raw.replace(/[^0-9.,]/g, '');

    // Prevent multiple decimal points
    const parts = cleaned.replace(/,/g, '').split('.');
    const validInput =
      parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned.replace(/,/g, '');

    // Format with commas and add back negative sign if present
    const formattedValue = formatNumberWithCommas(validInput);
    const displayValue = hasNegative ? `-${formattedValue}` : formattedValue;
    setInputValue(displayValue);
    onChange(parseNumericInput(displayValue, allowNegative));
  };

  const isNegative = value < 0;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className={`absolute left-3 top-2 ${isNegative ? 'text-red-600' : 'text-gray-600'}`}>$</span>
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleChange}
          className={`w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isNegative ? 'text-red-600' : 'text-gray-900'}`}
          placeholder="0"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {warning && !error && <p className="text-xs text-amber-600 mt-1">{warning}</p>}
      {hint && !error && !warning && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}
