/**
 * Centralized test data loader with proper typing.
 * Eliminates the need for `as TypeName` assertions throughout tests.
 */

import {
  TaxBracketsData,
  DeductionsData,
  SharedLimitsData,
  FederalLimitsData,
  CaliforniaLimitsData,
  ColoradoLimitsData,
  FloridaLimitsData,
  WashingtonLimitsData,
  NewYorkLimitsData,
  IllinoisLimitsData,
  IllinoisDeductionsData,
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
import allColoradoBrackets from '../../data/colorado-brackets.json';
import allColoradoLimits from '../../data/colorado-limits.json';
import allFloridaBrackets from '../../data/florida-brackets.json';
import allFloridaLimits from '../../data/florida-limits.json';
import allWashingtonBrackets from '../../data/washington-brackets.json';
import allSharedLimits from '../../data/limits.json';
import allFederalLimits from '../../data/federal-limits.json';
import allCaliforniaLimits from '../../data/california-limits.json';
import allWashingtonLimits from '../../data/washington-limits.json';
import allNewYorkBrackets from '../../data/newyork-brackets.json';
import allNewYorkDeductions from '../../data/newyork-deductions.json';
import allNewYorkLimits from '../../data/newyork-limits.json';
import allNYCBrackets from '../../data/nyc-brackets.json';
import allIllinoisBrackets from '../../data/illinois-brackets.json';
import allIllinoisDeductions from '../../data/illinois-deductions.json';
import allIllinoisLimits from '../../data/illinois-limits.json';
import allFicaData from '../../data/fica.json';

// Export typed data for the current tax year
export const federalBrackets = allFederalBrackets[TAX_YEAR] as TaxBracketsData;
export const ltcgBrackets = allLtcgBrackets[TAX_YEAR] as TaxBracketsData;
export const federalDeductions = allFederalDeductions[TAX_YEAR] as DeductionsData;
export const californiaBrackets = allCaliforniaBrackets[TAX_YEAR] as TaxBracketsData;
export const californiaDeductions = allCaliforniaDeductions[TAX_YEAR] as DeductionsData;
export const coloradoBrackets = allColoradoBrackets[TAX_YEAR] as TaxBracketsData;
export const coloradoLimits = allColoradoLimits[TAX_YEAR] as ColoradoLimitsData;
export const floridaBrackets = allFloridaBrackets[TAX_YEAR] as TaxBracketsData;
export const floridaLimits = allFloridaLimits[TAX_YEAR] as FloridaLimitsData;
export const washingtonBrackets = allWashingtonBrackets[TAX_YEAR] as TaxBracketsData;
export const sharedLimits = allSharedLimits[TAX_YEAR] as SharedLimitsData;
export const federalLimits = allFederalLimits[TAX_YEAR] as FederalLimitsData;
export const californiaLimits = allCaliforniaLimits[TAX_YEAR] as CaliforniaLimitsData;
export const washingtonLimits = allWashingtonLimits[TAX_YEAR] as WashingtonLimitsData;
export const newYorkBrackets = allNewYorkBrackets[TAX_YEAR] as TaxBracketsData;
export const newYorkDeductions = allNewYorkDeductions[TAX_YEAR] as DeductionsData;
export const newYorkLimits = allNewYorkLimits[TAX_YEAR] as NewYorkLimitsData;
export const nycBrackets = allNYCBrackets[TAX_YEAR] as TaxBracketsData;
export const illinoisBrackets = allIllinoisBrackets[TAX_YEAR] as TaxBracketsData;
export const illinoisDeductions = allIllinoisDeductions[TAX_YEAR] as IllinoisDeductionsData;
export const illinoisLimits = allIllinoisLimits[TAX_YEAR] as IllinoisLimitsData;
export const ficaData = allFicaData[TAX_YEAR] as FicaData;

/**
 * Creates a TaxInputs object with sensible defaults.
 * Override any field by passing it in the overrides parameter.
 */
export function createDefaultInputs(overrides: Partial<TaxInputs> = {}): TaxInputs {
  return {
    federalIncome: 0,
    stateIncome: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    federalTaxWithheld: 0,
    stateTaxWithheld: 0,
    federalEstimatedPaid: 0,
    stateEstimatedPaid: 0,
    filingStatus: 'single',
    selectedState: 'california',
    propertyTaxesPaid: 0,
    mortgageInterestPaid: 0,
    mortgageBalance: 0,
    charitableContributions: 0,
    contributions401k: 0,
    preTaxMedical: 0,
    priorYearFederalTaxPaid: 0,
    priorYearStateTaxPaid: 0,
    priorYearShortTermLossCarryover: 0,
    priorYearLongTermLossCarryover: 0,
    selfEmploymentIncome: 0,
    ...overrides,
  };
}
