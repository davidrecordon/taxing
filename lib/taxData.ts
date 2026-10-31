import type { FederalData } from "./calculate";
import { TaxYear } from "./config";
import { StateData } from "./stateData";
import {
  CaliforniaLimitsData,
  CaliforniaWithholdingData,
  ColoradoLimitsData,
  ColoradoWithholdingData,
  DCLimitsData,
  DeductionsData,
  FederalLimitsData,
  FicaData,
  FloridaLimitsData,
  IllinoisDeductionsData,
  IllinoisLimitsData,
  IllinoisWithholdingData,
  NewYorkLimitsData,
  NewYorkWithholdingData,
  SharedLimitsData,
  TaxBracketsData,
  TaxState,
  WashingtonLimitsData,
} from "./types";

import allCaliforniaBrackets from "../data/california-brackets.json";
import allCaliforniaDeductions from "../data/california-deductions.json";
import allCaliforniaLimits from "../data/california-limits.json";
import allCaliforniaWithholding from "../data/california-withholding.json";
import allColoradoBrackets from "../data/colorado-brackets.json";
import allColoradoLimits from "../data/colorado-limits.json";
import allColoradoWithholding from "../data/colorado-withholding.json";
import allDCBrackets from "../data/dc-brackets.json";
import allDCDeductions from "../data/dc-deductions.json";
import allDCLimits from "../data/dc-limits.json";
import allFederalBrackets from "../data/federal-brackets.json";
import allFederalDeductions from "../data/federal-deductions.json";
import allFederalLimits from "../data/federal-limits.json";
import allLtcgBrackets from "../data/federal-ltcg-brackets.json";
import allFicaData from "../data/fica.json";
import allFloridaBrackets from "../data/florida-brackets.json";
import allFloridaLimits from "../data/florida-limits.json";
import allIllinoisBrackets from "../data/illinois-brackets.json";
import allIllinoisDeductions from "../data/illinois-deductions.json";
import allIllinoisLimits from "../data/illinois-limits.json";
import allIllinoisWithholding from "../data/illinois-withholding.json";
import allSharedLimits from "../data/limits.json";
import allNewYorkBrackets from "../data/newyork-brackets.json";
import allNewYorkDeductions from "../data/newyork-deductions.json";
import allNewYorkLimits from "../data/newyork-limits.json";
import allNewYorkWithholding from "../data/newyork-withholding.json";
import allNYCBrackets from "../data/nyc-brackets.json";
import allNYCWithholding from "../data/nyc-withholding.json";
import allWashingtonBrackets from "../data/washington-brackets.json";
import allWashingtonLimits from "../data/washington-limits.json";

/**
 * Every data file for one tax year, loaded synchronously. For code that runs
 * outside the browser (the MCP server, tests), where bundle size does not
 * matter. The page keeps `stateData.ts`, which loads one state at a time.
 */

export function loadFederalData(year: TaxYear): FederalData {
  return {
    federalBrackets: allFederalBrackets[year] as TaxBracketsData,
    federalDeductions: allFederalDeductions[year] as DeductionsData,
    federalLimits: allFederalLimits[year] as FederalLimitsData,
    ficaData: allFicaData[year] as FicaData,
    ltcgBrackets: allLtcgBrackets[year] as TaxBracketsData,
    sharedLimits: allSharedLimits[year] as SharedLimitsData,
  };
}

// One state's data for a year, the same shape `stateData.ts` loads lazily
export function loadStateDataSync(state: TaxState, year: TaxYear): StateData {
  switch (state) {
    case "california":
      return {
        brackets: allCaliforniaBrackets[year] as TaxBracketsData,
        deductions: allCaliforniaDeductions[year] as DeductionsData,
        limits: allCaliforniaLimits[year] as CaliforniaLimitsData,
        withholding: allCaliforniaWithholding[
          year
        ] as CaliforniaWithholdingData,
      };
    case "colorado":
      return {
        brackets: allColoradoBrackets[year] as TaxBracketsData,
        limits: allColoradoLimits[year] as ColoradoLimitsData,
        withholding: allColoradoWithholding[year] as ColoradoWithholdingData,
      };
    case "dc":
      return {
        brackets: allDCBrackets[year] as TaxBracketsData,
        deductions: allDCDeductions[year] as DeductionsData,
        limits: allDCLimits[year] as DCLimitsData,
      };
    case "florida":
      return {
        brackets: allFloridaBrackets[year] as TaxBracketsData,
        limits: allFloridaLimits[year] as FloridaLimitsData,
      };
    case "illinois":
      return {
        brackets: allIllinoisBrackets[year] as TaxBracketsData,
        deductions: allIllinoisDeductions[year] as IllinoisDeductionsData,
        limits: allIllinoisLimits[year] as IllinoisLimitsData,
        withholding: allIllinoisWithholding[year] as IllinoisWithholdingData,
      };
    case "newyork":
      return {
        brackets: allNewYorkBrackets[year] as TaxBracketsData,
        nycBrackets: allNYCBrackets[year] as TaxBracketsData,
        deductions: allNewYorkDeductions[year] as DeductionsData,
        limits: allNewYorkLimits[year] as NewYorkLimitsData,
        withholding: allNewYorkWithholding[year] as NewYorkWithholdingData,
        nycWithholding: allNYCWithholding[year] as NewYorkWithholdingData,
      };
    case "washington":
      return {
        brackets: allWashingtonBrackets[year] as TaxBracketsData,
        limits: allWashingtonLimits[year] as WashingtonLimitsData,
      };
  }
}
