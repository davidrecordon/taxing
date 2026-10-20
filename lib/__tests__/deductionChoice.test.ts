import { describe, it, expect } from "vitest";
import { calculateResults } from "./calculateResults";

// DC must take the same type of deduction as the federal return, and a filer
// may take the smaller federal deduction, so the pair with the lower combined
// tax is used (2026, single: $16,100 standard deduction on both returns)
describe("calculateWithSharedDeductionChoice", () => {
  it("keeps the larger federal deduction when that is lower overall", () => {
    // Federal itemized: $9,500 + $6,000 + $5,000 + $250 of charity above the
    // $750 floor = $20,750, worth $4,650 x 24% = $1,116 over the standard
    // deduction. DC itemized: $11,250, costing $4,850 x 8.5% = $412.25.
    const { federal, state } = calculateResults("dc", {
      federalIncome: 150000,
      stateTaxWithheld: 9500,
      propertyTaxesPaid: 6000,
      mortgageInterestPaid: 5000,
      charitableContributions: 1000,
    });

    expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
    expect(federal.deductionBreakdown.deductionAmount).toBe(20750);
    expect(federal.deductionBreakdown.chosenForStateTax).toBeUndefined();
    expect(state.deductionBreakdown.deductionUsed).toBe("itemized");
    expect(state.deductionBreakdown.deductionAmount).toBe(11250);
  });

  it("takes the federal standard deduction when itemizing would cost more in DC", () => {
    // Federal itemized: $14,000 + $4,250 of charity above the $750 floor =
    // $18,250, worth $2,150 x 24% = $516. DC would itemize only $4,250 and
    // lose $11,850 x 8.5% = $1,007.25.
    const { federal, state } = calculateResults("dc", {
      federalIncome: 150000,
      stateTaxWithheld: 14000,
      charitableContributions: 5000,
    });

    expect(federal.deductionBreakdown.deductionUsed).toBe("standard");
    expect(federal.deductionBreakdown.deductionAmount).toBe(16100);
    expect(federal.deductionBreakdown.itemizedDeduction).toBe(18250);
    expect(federal.deductionBreakdown.chosenForStateTax).toBe(true);
    expect(state.deductionBreakdown.deductionUsed).toBe("standard");
    expect(state.deductionBreakdown.deductionAmount).toBe(16100);
  });

  it("itemizes on the federal return when that saves more in DC", () => {
    // AGI $600,000: the SALT cap is $40,400 - 30% x $95,000 = $11,900, so
    // Federal itemized is $11,900, costing $4,200 x 35% = $1,470 against the
    // standard deduction. DC itemized: $100,000 - 5% x $400,000 = $80,000,
    // saving $63,900 x 9.75% = $6,230.25.
    const inputs = {
      federalIncome: 600000,
      propertyTaxesPaid: 100000,
    };
    const { federal, state } = calculateResults("dc", inputs);

    expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
    expect(federal.deductionBreakdown.deductionAmount).toBe(11900);
    expect(federal.deductionBreakdown.chosenForStateTax).toBe(true);
    expect(state.deductionBreakdown.deductionUsed).toBe("itemized");
    expect(state.deductionBreakdown.deductionAmount).toBe(80000);

    // Federal taxable income is $600,000 - $11,900
    expect(federal.taxableOrdinaryIncome).toBe(588100);
  });

  it("leaves other states to choose their own deduction", () => {
    const { federal } = calculateResults("california", {
      federalIncome: 150000,
      stateTaxWithheld: 14000,
      charitableContributions: 5000,
    });

    expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
    expect(federal.deductionBreakdown.chosenForStateTax).toBeUndefined();
  });
});
