// Tax year configuration
export const SUPPORTED_YEARS = ['2025', '2026'] as const;
export type TaxYear = (typeof SUPPORTED_YEARS)[number];
export const TAX_YEAR: TaxYear = '2025';
