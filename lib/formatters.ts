export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(rate: number, decimals?: 0 | 1 | 2): string {
  let decimalPlaces: number;

  if (decimals !== undefined) {
    // Use explicit decimal places if specified
    decimalPlaces = decimals;
  } else {
    // Auto-detect decimals needed (0, 1, or 2)
    const percentValue = rate * 100;
    decimalPlaces = 0;
    if (Math.abs(percentValue - Math.round(percentValue)) >= 0.0001) {
      // Need at least 1 decimal
      const rounded1 = Math.round(percentValue * 10) / 10;
      if (Math.abs(percentValue - rounded1) >= 0.0001) {
        decimalPlaces = 2; // Need 2 decimals (e.g., 4.95%)
      } else {
        decimalPlaces = 1; // Need 1 decimal (e.g., 9.5%)
      }
    }
  }

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(rate);
}

export function parseNumericInput(value: string, allowNegative: boolean = false): number {
  // Check for negative sign at start
  const isNegative = allowNegative && value.trimStart().startsWith('-');

  // Remove everything except digits and periods (strip commas and minus signs)
  let cleaned = value.replace(/[^0-9.]/g, '');

  // Handle multiple decimal points - keep only the first
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  let parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;

  // Apply negative sign if detected and allowed
  if (isNegative) {
    parsed = -parsed;
  }

  // Only clamp to 0 if negative values are not allowed
  return allowNegative ? parsed : Math.max(0, parsed);
}

export function formatNumberWithCommas(value: string): string {
  if (!value) return '';

  // Split on decimal point
  const [integerPart, decimalPart] = value.split('.');

  // Remove existing commas and add new ones
  const cleanInteger = integerPart.replace(/,/g, '');
  const formattedInteger = cleanInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Reconstruct the number
  if (decimalPart !== undefined) {
    return formattedInteger + '.' + decimalPart;
  }
  return formattedInteger;
}
