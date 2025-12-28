export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(rate: number): string {
  // Check if the percentage is a whole number (e.g., 0.90 = 90%)
  const percentValue = rate * 100;
  const isWholeNumber = Math.abs(percentValue - Math.round(percentValue)) < 0.0001;
  const decimals = isWholeNumber ? 0 : 1;

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rate);
}

export function parseNumericInput(value: string): number {
  // Remove everything except digits and periods (strip commas too)
  let cleaned = value.replace(/[^0-9.]/g, '');

  // Handle multiple decimal points - keep only the first
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
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
