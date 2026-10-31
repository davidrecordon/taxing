import { describe, it, expect } from "vitest";
import {
  SplitConfig,
  buildSpouseInputs,
  defaultWagesSplit,
} from "../spouseInputs";
import { TaxInputs } from "../types";
import { createDefaultInputs } from "./testData";

// A joint return with a different round figure in every amount field
const joint: TaxInputs = createDefaultInputs({
  filingStatus: "marriedFilingJointly",
  selectedState: "newyork",
  isNYCResident: true,
  isMortgageGrandfathered: true,
  priorYearIncomeOverThreshold: false,
  federalIncome: 400000,
  supplementalWages: 50000,
  spouseWages: 150000,
  stateIncome: 380000,
  selfEmploymentIncome: 60000,
  shortTermCapitalGains: 20000,
  longTermCapitalGains: 100000,
  interestIncome: 8000,
  treasuryInterest: 2000,
  ordinaryDividends: 12000,
  qualifiedDividends: 10000,
  contributions401k: 40000,
  preTaxMedical: 6000,
  propertyTaxesPaid: 18000,
  mortgageInterestPaid: 30000,
  mortgageBalance: 900000,
  charitableContributions: 16000,
  priorYearShortTermLossCarryover: 4000,
  priorYearLongTermLossCarryover: 14000,
  federalTaxWithheld: 90000,
  stateTaxWithheld: 28000,
  federalEstimatedPaid: 10000,
  stateEstimatedPaid: 5000,
  priorYearFederalTax: 110000,
  priorYearStateTax: 36000,
  priorYearStateBalancePaid: 3000,
});

const evenSplit: SplitConfig = {
  wages: 50,
  stcg: 50,
  ltcg: 50,
  dividends: 50,
  contributions401k: 50,
  preTaxMedical: 50,
  deductions: 50,
};

const spouses = (splits: SplitConfig) => ({
  spouse1: buildSpouseInputs(joint, splits, true),
  spouse2: buildSpouseInputs(joint, splits, false),
});

describe("defaultWagesSplit", () => {
  it("is spouse 1's share once the spouse's wages are known", () => {
    // $400,000 of wages, $150,000 of them the spouse's: spouse 1 has 62.5%
    expect(defaultWagesSplit(joint)).toBeCloseTo(62.5, 10);
  });

  it("is an even split without them", () => {
    expect(defaultWagesSplit({ ...joint, spouseWages: 0 })).toBe(50);
    expect(
      defaultWagesSplit({ ...joint, filingStatus: "marriedFilingSeparately" }),
    ).toBe(50);
  });
});

describe("buildSpouseInputs", () => {
  it("files each spouse as married filing separately", () => {
    const { spouse1, spouse2 } = spouses(evenSplit);

    expect(spouse1.filingStatus).toBe("marriedFilingSeparately");
    expect(spouse2.filingStatus).toBe("marriedFilingSeparately");
  });

  it("gives spouse 1 the stated percentage and spouse 2 the remainder", () => {
    // 70% of $400,000 of wages, and the other 30%
    const { spouse1, spouse2 } = spouses({ ...evenSplit, wages: 70 });

    expect(spouse1.federalIncome).toBe(280000);
    expect(spouse2.federalIncome).toBe(120000);
  });

  it("gives everything to one spouse at 100% or 0%", () => {
    const all = spouses({ ...evenSplit, ltcg: 100 });
    expect(all.spouse1.longTermCapitalGains).toBe(100000);
    expect(all.spouse2.longTermCapitalGains).toBe(0);

    const none = spouses({ ...evenSplit, ltcg: 0 });
    expect(none.spouse1.longTermCapitalGains).toBe(0);
    expect(none.spouse2.longTermCapitalGains).toBe(100000);
  });

  it("neither loses nor double-counts any amount, whatever the split", () => {
    // Every amount on the joint return must be divided: a field that is
    // left out would be counted in full for both spouses
    const { spouse1, spouse2 } = spouses({
      wages: 70,
      stcg: 20,
      ltcg: 90,
      dividends: 40,
      contributions401k: 60,
      preTaxMedical: 10,
      deductions: 80,
    });
    // The spouse's wages are the one exception: each separate return has a
    // single earner, so neither carries them
    const amountFields = (Object.keys(joint) as (keyof TaxInputs)[]).filter(
      (field) => typeof joint[field] === "number" && field !== "spouseWages",
    );

    expect(amountFields).toHaveLength(25);
    expect(spouse1.spouseWages).toBe(0);
    expect(spouse2.spouseWages).toBe(0);
    for (const field of amountFields) {
      expect(
        (spouse1[field] as number) + (spouse2[field] as number),
        field,
      ).toBeCloseTo(joint[field] as number, 6);
    }
  });

  describe("which split governs which amount", () => {
    // Spouse 1's share of each amount when one split is 100% and the rest 0%
    const spouse1With = (split: keyof SplitConfig) =>
      buildSpouseInputs(
        joint,
        {
          wages: 0,
          stcg: 0,
          ltcg: 0,
          dividends: 0,
          contributions401k: 0,
          preTaxMedical: 0,
          deductions: 0,
          [split]: 100,
        },
        true,
      );
    const fieldsMovedBy = (split: keyof SplitConfig) => {
      const spouse1 = spouse1With(split);
      return (Object.keys(joint) as (keyof TaxInputs)[])
        .filter(
          (field) => typeof joint[field] === "number" && spouse1[field] !== 0,
        )
        .sort();
    };

    it("wages: wages, self-employment income, and everything paid or owed with them", () => {
      expect(fieldsMovedBy("wages")).toEqual([
        "federalEstimatedPaid",
        "federalIncome",
        "federalTaxWithheld",
        "priorYearFederalTax",
        "priorYearStateBalancePaid",
        "priorYearStateTax",
        "selfEmploymentIncome",
        "stateEstimatedPaid",
        "stateIncome",
        "stateTaxWithheld",
        "supplementalWages",
      ]);
    });

    it("short-term gains: the gains and the short-term loss carryover", () => {
      expect(fieldsMovedBy("stcg")).toEqual([
        "priorYearShortTermLossCarryover",
        "shortTermCapitalGains",
      ]);
    });

    it("long-term gains: the gains and the long-term loss carryover", () => {
      expect(fieldsMovedBy("ltcg")).toEqual([
        "longTermCapitalGains",
        "priorYearLongTermLossCarryover",
      ]);
    });

    it("interest and dividends: both, with their Treasury and qualified portions", () => {
      expect(fieldsMovedBy("dividends")).toEqual([
        "interestIncome",
        "ordinaryDividends",
        "qualifiedDividends",
        "treasuryInterest",
      ]);
    });

    it("401(k): contributions only", () => {
      expect(fieldsMovedBy("contributions401k")).toEqual(["contributions401k"]);
    });

    it("pre-tax medical: that amount only", () => {
      expect(fieldsMovedBy("preTaxMedical")).toEqual(["preTaxMedical"]);
    });

    it("deductions: property tax, mortgage interest and balance, and charitable giving", () => {
      expect(fieldsMovedBy("deductions")).toEqual([
        "charitableContributions",
        "mortgageBalance",
        "mortgageInterestPaid",
        "propertyTaxesPaid",
      ]);
    });
  });

  it("carries over what is not an amount unchanged", () => {
    const { spouse1 } = spouses(evenSplit);

    expect(spouse1.taxYear).toBe(joint.taxYear);
    expect(spouse1.selectedState).toBe("newyork");
    expect(spouse1.isNYCResident).toBe(true);
    expect(spouse1.isMortgageGrandfathered).toBe(true);
    expect(spouse1.priorYearIncomeOverThreshold).toBe(false);
  });
});
