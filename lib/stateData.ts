import { TAX_YEAR, TaxYear } from "./config";
import { TaxState } from "./types";

// Type definitions for state data
export interface StateData {
  brackets: unknown;
  deductions?: unknown;
  limits: unknown;
}

// Cache for loaded state data (keyed by `${state}-${year}`)
const stateDataCache = new Map<string, StateData>();

// Dynamic import functions for each state's data
const stateDataLoaders: Record<TaxState, (year: TaxYear) => Promise<StateData>> = {
  california: async (year) => {
    const [brackets, deductions, limits] = await Promise.all([
      import("@/data/california-brackets.json"),
      import("@/data/california-deductions.json"),
      import("@/data/california-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      deductions: deductions.default[year],
      limits: limits.default[year],
    };
  },
  colorado: async (year) => {
    const [brackets, limits] = await Promise.all([
      import("@/data/colorado-brackets.json"),
      import("@/data/colorado-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      limits: limits.default[year],
    };
  },
  dc: async (year) => {
    const [brackets, deductions, limits] = await Promise.all([
      import("@/data/dc-brackets.json"),
      import("@/data/dc-deductions.json"),
      import("@/data/dc-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      deductions: deductions.default[year],
      limits: limits.default[year],
    };
  },
  florida: async (year) => {
    const [brackets, limits] = await Promise.all([
      import("@/data/florida-brackets.json"),
      import("@/data/florida-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      limits: limits.default[year],
    };
  },
  illinois: async (year) => {
    const [brackets, deductions, limits] = await Promise.all([
      import("@/data/illinois-brackets.json"),
      import("@/data/illinois-deductions.json"),
      import("@/data/illinois-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      deductions: deductions.default[year],
      limits: limits.default[year],
    };
  },
  newyork: async (year) => {
    const [brackets, nycBrackets, deductions, limits] = await Promise.all([
      import("@/data/newyork-brackets.json"),
      import("@/data/nyc-brackets.json"),
      import("@/data/newyork-deductions.json"),
      import("@/data/newyork-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      nycBrackets: nycBrackets.default[year],
      deductions: deductions.default[year],
      limits: limits.default[year],
    };
  },
  washington: async (year) => {
    const [brackets, limits] = await Promise.all([
      import("@/data/washington-brackets.json"),
      import("@/data/washington-limits.json"),
    ]);
    return {
      brackets: brackets.default[year],
      limits: limits.default[year],
    };
  },
};

/**
 * Load state-specific tax data. Results are cached after first load.
 */
export async function loadStateData(
  state: TaxState,
  year: TaxYear = TAX_YEAR,
): Promise<StateData> {
  const key = `${state}-${year}`;
  const cached = stateDataCache.get(key);
  if (cached) {
    return cached;
  }

  const data = await stateDataLoaders[state](year);
  stateDataCache.set(key, data);
  return data;
}

/**
 * Preload state data without awaiting (fire and forget).
 * Useful for preloading on hover or when user is likely to switch states.
 */
export function preloadStateData(
  state: TaxState,
  year: TaxYear = TAX_YEAR,
): void {
  const key = `${state}-${year}`;
  if (!stateDataCache.has(key)) {
    void loadStateData(state, year);
  }
}

/**
 * Check if state data is already loaded (cached).
 */
export function isStateDataLoaded(
  state: TaxState,
  year: TaxYear = TAX_YEAR,
): boolean {
  return stateDataCache.has(`${state}-${year}`);
}

/**
 * Get cached state data synchronously. Returns undefined if not loaded.
 */
export function getStateDataSync(
  state: TaxState,
  year: TaxYear = TAX_YEAR,
): StateData | undefined {
  return stateDataCache.get(`${state}-${year}`);
}
