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
}

export default function CurrencyInput({
  label,
  value,
  onChange,
  hint,
  warning,
  error,
}: CurrencyInputProps) {
  const id = useId();
  const [inputValue, setInputValue] = useState(
    value ? formatNumberWithCommas(String(value)) : ''
  );

  // Sync with external value changes (e.g., form reset)
  useEffect(() => {
    const numericValue = parseNumericInput(inputValue);
    if (value !== numericValue) {
      setInputValue(value ? formatNumberWithCommas(String(value)) : '');
    }
  }, [value, inputValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Only allow digits, decimal point, and commas
    const cleaned = raw.replace(/[^0-9.,]/g, '');

    // Prevent multiple decimal points
    const parts = cleaned.replace(/,/g, '').split('.');
    const validInput =
      parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned.replace(/,/g, '');

    // Format with commas
    const formattedValue = formatNumberWithCommas(validInput);
    setInputValue(formattedValue);
    onChange(parseNumericInput(formattedValue));
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-gray-600">$</span>
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="0"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {warning && !error && <p className="text-xs text-amber-600 mt-1">{warning}</p>}
      {hint && !error && !warning && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}
