/**
 * Centralized test data loader with proper typing.
 * Eliminates the need for `as TypeName` assertions throughout tests.
 */

import {
  TaxBracketsData,
  DeductionsData,
  LimitsData,
  FicaData,
  TaxInputs,
} from '../types';
import { TAX_YEAR } from '../config';

// Load multi-year JSON data
import allFederalBrackets from '../../data/federal-brackets.json';
import allLtcgBrackets from '../../data/federal-ltcg-brackets.json';
import allFederalDeductions from '../../data/federal-deductions.json';
import allCaliforniaBrackets from '../../data/california-brackets.json';
import allCaliforniaDeductions from '../../data/california-deductions.json';
import allLimits from '../../data/limits.json';
import allFicaData from '../../data/fica.json';

// Export typed data for the current tax year
export const federalBrackets = allFederalBrackets[TAX_YEAR] as TaxBracketsData;
export const ltcgBrackets = allLtcgBrackets[TAX_YEAR] as TaxBracketsData;
export const federalDeductions = allFederalDeductions[TAX_YEAR] as DeductionsData;
export const californiaBrackets = allCaliforniaBrackets[TAX_YEAR] as TaxBracketsData;
export const californiaDeductions = allCaliforniaDeductions[TAX_YEAR] as DeductionsData;
export const limits = allLimits[TAX_YEAR] as LimitsData;
export const ficaData = allFicaData[TAX_YEAR] as FicaData;

/**
 * Creates a TaxInputs object with sensible defaults.
 * Override any field by passing it in the overrides parameter.
 */
export function createDefaultInputs(overrides: Partial<TaxInputs> = {}): TaxInputs {
  return {
    federalIncome: 0,
    californiaIncome: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    federalTaxWithheld: 0,
    californiaTaxWithheld: 0,
    federalEstimatedPaid: 0,
    californiaEstimatedPaid: 0,
    filingStatus: 'single',
    propertyTaxesPaid: 0,
    mortgageInterestPaid: 0,
    mortgageBalance: 0,
    charitableContributions: 0,
    contributions401k: 0,
    priorYearFederalTaxPaid: 0,
    priorYearCaliforniaTaxPaid: 0,
    priorYearShortTermLossCarryover: 0,
    priorYearLongTermLossCarryover: 0,
    ...overrides,
  };
}
