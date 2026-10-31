import { TaxYear } from "../config";

/**
 * Where the data stands for each year, as recorded in data/VERIFICATION.md.
 * Returned with every tool result so a caller knows which figures were
 * verified against official sources and which still use last year's value.
 * Keep in step with the "Data Status" section of VERIFICATION.md.
 */
export interface DataStatus {
  verifiedOn: string;
  waiting: string[];
}

export const DATA_STATUS: Record<TaxYear, DataStatus> = {
  "2025": {
    verifiedOn: "2026-10-19",
    waiting: [],
  },
  "2026": {
    verifiedOn: "2026-10-19",
    waiting: [
      "Washington 2026 capital gains standard deduction; 2025 value in use",
      "California 2026 itemized deduction limitation thresholds; 2025 values in use",
      "DC 2026 standard deduction; 2025 value in use",
      "New York 2026 form instructions and New York City school tax credit amounts; 2025 values in use",
    ],
  },
};
