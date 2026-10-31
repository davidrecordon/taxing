import { describe, expect, it } from "vitest";
import {
  earnerInputs,
  earnerShares,
  earnerWages,
  spouseWages,
} from "../earners";
import { createDefaultInputs } from "./testData";

describe("spouseWages", () => {
  it("is the spouse's part of the wages on a joint return", () => {
    expect(
      spouseWages(
        createDefaultInputs({
          filingStatus: "marriedFilingJointly",
          federalIncome: 300000,
          spouseWages: 100000,
        }),
      ),
    ).toBe(100000);
  });

  it("is nothing unless the return is joint", () => {
    for (const filingStatus of ["single", "marriedFilingSeparately"] as const) {
      expect(
        spouseWages(
          createDefaultInputs({
            filingStatus,
            federalIncome: 300000,
            spouseWages: 100000,
          }),
        ),
      ).toBe(0);
    }
  });

  it("cannot exceed the wages", () => {
    expect(
      spouseWages(
        createDefaultInputs({
          filingStatus: "marriedFilingJointly",
          federalIncome: 100000,
          spouseWages: 150000,
        }),
      ),
    ).toBe(100000);
  });
});

describe("earnerShares and earnerWages", () => {
  it("are one earner with everything when no spouse wages are given", () => {
    const inputs = createDefaultInputs({
      filingStatus: "marriedFilingJointly",
      federalIncome: 300000,
    });

    expect(earnerShares(inputs)).toEqual([1]);
    expect(earnerWages(inputs)).toEqual([300000]);
  });

  it("divide the wages between the two earners", () => {
    const inputs = createDefaultInputs({
      filingStatus: "marriedFilingJointly",
      federalIncome: 300000,
      spouseWages: 100000,
    });

    expect(earnerShares(inputs)[0]).toBeCloseTo(2 / 3, 10);
    expect(earnerShares(inputs)[1]).toBeCloseTo(1 / 3, 10);
    expect(earnerWages(inputs)[0]).toBeCloseTo(200000, 6);
    expect(earnerWages(inputs)[1]).toBeCloseTo(100000, 6);
  });

  it("add back to the wages exactly, so equal owed and withheld figures compare equal", () => {
    // 291,000 - 241,000 is exact; a share multiplied back would not be
    const inputs = createDefaultInputs({
      filingStatus: "marriedFilingJointly",
      federalIncome: 291000,
      spouseWages: 241000,
    });

    expect(earnerWages(inputs)).toEqual([50000, 241000]);
  });

  it("leave the first earner nothing when the spouse earned all the wages", () => {
    const inputs = createDefaultInputs({
      filingStatus: "marriedFilingJointly",
      federalIncome: 300000,
      spouseWages: 300000,
    });

    expect(earnerWages(inputs)).toEqual([0, 300000]);
  });
});

describe("earnerInputs", () => {
  const joint = createDefaultInputs({
    filingStatus: "marriedFilingJointly",
    federalIncome: 300000,
    stateIncome: 270000,
    supplementalWages: 30000,
    contributions401k: 24000,
    preTaxMedical: 6000,
    spouseWages: 100000,
    interestIncome: 5000,
    federalTaxWithheld: 40000,
  });

  it("gives each earner their share of the wages and what is paid with them", () => {
    const [first, spouse] = earnerInputs(joint);

    expect(first.federalIncome).toBeCloseTo(200000, 6);
    expect(first.stateIncome).toBeCloseTo(180000, 6);
    expect(first.supplementalWages).toBeCloseTo(20000, 6);
    expect(first.contributions401k).toBeCloseTo(16000, 6);
    expect(first.preTaxMedical).toBeCloseTo(4000, 6);

    expect(spouse.federalIncome).toBeCloseTo(100000, 6);
    expect(spouse.stateIncome).toBeCloseTo(90000, 6);
    expect(spouse.supplementalWages).toBeCloseTo(10000, 6);
    expect(spouse.contributions401k).toBeCloseTo(8000, 6);
    expect(spouse.preTaxMedical).toBeCloseTo(2000, 6);
  });

  it("leaves each earner with no spouse of their own, and everything else as it was", () => {
    for (const earner of earnerInputs(joint)) {
      expect(earner.spouseWages).toBe(0);
      expect(earner.filingStatus).toBe("marriedFilingJointly");
      expect(earner.interestIncome).toBe(5000);
      expect(earner.federalTaxWithheld).toBe(40000);
    }
  });

  it("is the return itself when there is one earner", () => {
    const single = createDefaultInputs({ federalIncome: 300000 });

    expect(earnerInputs(single)).toEqual([single]);
  });
});
