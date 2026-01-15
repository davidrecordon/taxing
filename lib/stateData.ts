import { TAX_YEAR } from './config';
import { TaxState } from './types';

// Type definitions for state data
export interface StateData {
  brackets: unknown;
  deductions?: unknown;
  limits: unknown;
}

// Cache for loaded state data
const stateDataCache = new Map<TaxState, StateData>();

// Dynamic import functions for each state's data
const stateDataLoaders: Record<TaxState, () => Promise<StateData>> = {
  california: async () => {
    const [brackets, deductions, limits] = await Promise.all([
      import('@/data/california-brackets.json'),
      import('@/data/california-deductions.json'),
      import('@/data/california-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      deductions: deductions.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
  colorado: async () => {
    const [brackets, limits] = await Promise.all([
      import('@/data/colorado-brackets.json'),
      import('@/data/colorado-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
  dc: async () => {
    const [brackets, deductions, limits] = await Promise.all([
      import('@/data/dc-brackets.json'),
      import('@/data/dc-deductions.json'),
      import('@/data/dc-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      deductions: deductions.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
  florida: async () => {
    const [brackets, limits] = await Promise.all([
      import('@/data/florida-brackets.json'),
      import('@/data/florida-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
  illinois: async () => {
    const [brackets, deductions, limits] = await Promise.all([
      import('@/data/illinois-brackets.json'),
      import('@/data/illinois-deductions.json'),
      import('@/data/illinois-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      deductions: deductions.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
  newyork: async () => {
    const [brackets, nycBrackets, deductions, limits] = await Promise.all([
      import('@/data/newyork-brackets.json'),
      import('@/data/nyc-brackets.json'),
      import('@/data/newyork-deductions.json'),
      import('@/data/newyork-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      nycBrackets: nycBrackets.default[TAX_YEAR],
      deductions: deductions.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
  washington: async () => {
    const [brackets, limits] = await Promise.all([
      import('@/data/washington-brackets.json'),
      import('@/data/washington-limits.json'),
    ]);
    return {
      brackets: brackets.default[TAX_YEAR],
      limits: limits.default[TAX_YEAR],
    };
  },
};

/**
 * Load state-specific tax data. Results are cached after first load.
 */
export async function loadStateData(state: TaxState): Promise<StateData> {
  const cached = stateDataCache.get(state);
  if (cached) {
    return cached;
  }

  const data = await stateDataLoaders[state]();
  stateDataCache.set(state, data);
  return data;
}

/**
 * Preload state data without awaiting (fire and forget).
 * Useful for preloading on hover or when user is likely to switch states.
 */
export function preloadStateData(state: TaxState): void {
  if (!stateDataCache.has(state)) {
    void loadStateData(state);
  }
}

/**
 * Check if state data is already loaded (cached).
 */
export function isStateDataLoaded(state: TaxState): boolean {
  return stateDataCache.has(state);
}

/**
 * Get cached state data synchronously. Returns undefined if not loaded.
 */
export function getStateDataSync(state: TaxState): StateData | undefined {
  return stateDataCache.get(state);
}
