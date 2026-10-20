import { describe, it, expect } from "vitest";
import {
  calculateEffectiveRate,
  calculateEffectiveRates,
  calculateLTCGTaxWithStacking,
  calculateTaxByBrackets,
  netCapitalGains,
  splitDividends,
  stateTaxableInterest,
  taxableInterest,
} from "../taxUtils";
import { sharedLimits } from "./testData";
import { TaxCalculationResult, TaxBracket } from "../types";

describe("calculateTaxByBrackets", () => {
  // Illustrative schedule: 10% to $10,000, 20% to $50,000, 30% above
  const brackets: TaxBracket[] = [
    { min: 0, max: 10000, rate: 0.1 },
    { min: 10000, max: 50000, rate: 0.2 },
    { min: 50000, max: null, rate: 0.3 },
  ];

  it("taxes income within the first bracket at that bracket's rate", () => {
    // $6,000 x 10% = $600
    const result = calculateTaxByBrackets(6000, brackets);

    expect(result.total).toBeCloseTo(600, 2);
    expect(result.breakdown).toHaveLength(1);
  });

  it("taxes each slice of income at its own bracket's rate", () => {
    // First $10,000 x 10% = $1,000
    // Next $20,000 x 20%  = $4,000
    // Total                 $5,000
    const result = calculateTaxByBrackets(30000, brackets);

    expect(result.total).toBeCloseTo(5000, 2);
    expect(result.breakdown).toHaveLength(2);
  });

  it("keeps income of exactly $10,000 entirely in the first bracket", () => {
    // $10,000 x 10% = $1,000, nothing reaches the 20% bracket
    const result = calculateTaxByBrackets(10000, brackets);

    expect(result.total).toBeCloseTo(1000, 2);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].incomeInBracket).toBe(10000);
  });

  it("taxes the first dollar over $10,000 at the next bracket's rate", () => {
    // $10,000 x 10% = $1,000.00
    // $1 x 20%      =     $0.20
    // Total           $1,000.20
    const result = calculateTaxByBrackets(10001, brackets);

    expect(result.total).toBeCloseTo(1000.2, 2);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[1].incomeInBracket).toBe(1);
    expect(result.breakdown[1].taxForBracket).toBeCloseTo(0.2, 2);
  });

  it("taxes everything above $50,000 in the top bracket, which has no upper limit", () => {
    // First $10,000 x 10%  =  $1,000
    // Next $40,000 x 20%   =  $8,000
    // Last $150,000 x 30%  = $45,000
    // Total                  $54,000
    const result = calculateTaxByBrackets(200000, brackets);

    expect(result.total).toBeCloseTo(54000, 2);
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown[2].bracketMax).toBeNull();
    expect(result.breakdown[2].incomeInBracket).toBe(150000);
  });

  it("returns one breakdown row per bracket the income reaches", () => {
    // $30,000: $10,000 at 10% = $1,000, then $20,000 at 20% = $4,000.
    // The 30% bracket is not reached, so it has no row.
    const { breakdown } = calculateTaxByBrackets(30000, brackets);

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toMatchObject({
      bracketMin: 0,
      bracketMax: 10000,
      rate: 0.1,
      incomeInBracket: 10000,
    });
    expect(breakdown[0].taxForBracket).toBeCloseTo(1000, 2);
    expect(breakdown[1]).toMatchObject({
      bracketMin: 10000,
      bracketMax: 50000,
      rate: 0.2,
      incomeInBracket: 20000,
    });
    expect(breakdown[1].taxForBracket).toBeCloseTo(4000, 2);
  });

  it("keeps the row for a 0% bracket, with no tax", () => {
    // 0% to $20,000, 10% above: $25,000 -> $20,000 x 0% + $5,000 x 10% = $500
    const result = calculateTaxByBrackets(25000, [
      { min: 0, max: 20000, rate: 0 },
      { min: 20000, max: null, rate: 0.1 },
    ]);

    expect(result.total).toBeCloseTo(500, 2);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]).toEqual({
      bracketMin: 0,
      bracketMax: 20000,
      rate: 0,
      incomeInBracket: 20000,
      taxForBracket: 0,
    });
  });

  it("returns no tax and no rows for zero income", () => {
    expect(calculateTaxByBrackets(0, brackets)).toEqual({
      total: 0,
      breakdown: [],
    });
  });

  it("returns no tax and no rows for negative income", () => {
    expect(calculateTaxByBrackets(-5000, brackets)).toEqual({
      total: 0,
      breakdown: [],
    });
  });
});

describe("calculateLTCGTaxWithStacking", () => {
  // Illustrative schedule: 0% to $50,000 of total taxable income,
  // 15% to $500,000, 20% above
  const brackets: TaxBracket[] = [
    { min: 0, max: 50000, rate: 0 },
    { min: 50000, max: 500000, rate: 0.15 },
    { min: 500000, max: null, rate: 0.2 },
  ];

  it("taxes gains at 0% when there is no ordinary income below them", () => {
    // $20,000 of gains occupy $0 to $20,000, all inside the 0% bracket
    const result = calculateLTCGTaxWithStacking(20000, 0, brackets);

    expect(result.total).toBe(0);
    expect(result.ltcgInZeroBracket).toBe(20000);
    expect(result.breakdown).toEqual([
      {
        bracketMin: 0,
        bracketMax: 50000,
        rate: 0,
        incomeInBracket: 20000,
        taxForBracket: 0,
      },
    ]);
  });

  it("stacks gains on top of ordinary income, so only the room left under $50,000 is taxed at 0%", () => {
    // $40,000 ordinary income fills $0 to $40,000
    // Room left at 0%: $50,000 - $40,000 = $10,000
    // Gains at 0%:  $10,000 x 0%  =     $0
    // Gains at 15%: $20,000 x 15% = $3,000
    const result = calculateLTCGTaxWithStacking(30000, 40000, brackets);

    expect(result.total).toBeCloseTo(3000, 2);
    expect(result.ltcgInZeroBracket).toBe(10000);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]).toEqual({
      bracketMin: 0,
      bracketMax: 50000,
      rate: 0,
      incomeInBracket: 10000,
      taxForBracket: 0,
    });
    expect(result.breakdown[1]).toMatchObject({
      bracketMin: 50000,
      bracketMax: 500000,
      rate: 0.15,
      incomeInBracket: 20000,
    });
    expect(result.breakdown[1].taxForBracket).toBeCloseTo(3000, 2);
  });

  it("taxes gains that end exactly at $50,000 of total income entirely at 0%", () => {
    // $40,000 ordinary + $10,000 gains = $50,000, the top of the 0% bracket
    const result = calculateLTCGTaxWithStacking(10000, 40000, brackets);

    expect(result.total).toBe(0);
    expect(result.ltcgInZeroBracket).toBe(10000);
    expect(result.breakdown).toHaveLength(1);
  });

  it("taxes the first dollar of gains over $50,000 of total income at 15%", () => {
    // $40,000 ordinary + $10,001 gains = $50,001
    // $10,000 x 0% + $1 x 15% = $0.15
    const result = calculateLTCGTaxWithStacking(10001, 40000, brackets);

    expect(result.total).toBeCloseTo(0.15, 2);
    expect(result.ltcgInZeroBracket).toBe(10000);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[1].incomeInBracket).toBe(1);
  });

  it("leaves no gains at 0% when ordinary income is exactly $50,000", () => {
    // Ordinary income fills the 0% bracket to the dollar
    // $20,000 x 15% = $3,000, and no empty 0% row is reported
    const result = calculateLTCGTaxWithStacking(20000, 50000, brackets);

    expect(result.total).toBeCloseTo(3000, 2);
    expect(result.ltcgInZeroBracket).toBe(0);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(0.15);
    expect(result.breakdown[0].incomeInBracket).toBe(20000);
  });

  it("leaves one dollar of gains at 0% when ordinary income is $49,999", () => {
    // Room left at 0%: $50,000 - $49,999 = $1
    // $1 x 0% + $19,999 x 15% = $2,999.85
    const result = calculateLTCGTaxWithStacking(20000, 49999, brackets);

    expect(result.total).toBeCloseTo(2999.85, 2);
    expect(result.ltcgInZeroBracket).toBe(1);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[1].incomeInBracket).toBe(19999);
  });

  it("taxes gains above $500,000 of total income at 20%", () => {
    // $480,000 ordinary income; room left at 15%: $500,000 - $480,000 = $20,000
    // $20,000 x 15% = $3,000
    // $30,000 x 20% = $6,000
    // Total           $9,000
    const result = calculateLTCGTaxWithStacking(50000, 480000, brackets);

    expect(result.total).toBeCloseTo(9000, 2);
    expect(result.ltcgInZeroBracket).toBe(0);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0].rate).toBe(0.15);
    expect(result.breakdown[0].incomeInBracket).toBe(20000);
    expect(result.breakdown[1].rate).toBe(0.2);
    expect(result.breakdown[1].incomeInBracket).toBe(30000);
  });

  it("taxes all gains at 20% when ordinary income is already above $500,000", () => {
    // $600,000 ordinary income; $50,000 x 20% = $10,000
    const result = calculateLTCGTaxWithStacking(50000, 600000, brackets);

    expect(result.total).toBeCloseTo(10000, 2);
    expect(result.ltcgInZeroBracket).toBe(0);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(0.2);
    expect(result.breakdown[0].incomeInBracket).toBe(50000);
  });

  it("spreads large gains across all three rates", () => {
    // No ordinary income, $600,000 of gains
    // $50,000 x 0%    =      $0
    // $450,000 x 15%  = $67,500
    // $100,000 x 20%  = $20,000
    // Total             $87,500
    const result = calculateLTCGTaxWithStacking(600000, 0, brackets);

    expect(result.total).toBeCloseTo(87500, 2);
    expect(result.ltcgInZeroBracket).toBe(50000);
    expect(result.breakdown.map((row) => row.incomeInBracket)).toEqual([
      50000, 450000, 100000,
    ]);
  });

  it("returns no tax and no rows for zero gains", () => {
    expect(calculateLTCGTaxWithStacking(0, 60000, brackets)).toEqual({
      total: 0,
      breakdown: [],
      ltcgInZeroBracket: 0,
    });
  });

  it("returns no tax and no rows for a net loss", () => {
    expect(calculateLTCGTaxWithStacking(-5000, 60000, brackets)).toEqual({
      total: 0,
      breakdown: [],
      ltcgInZeroBracket: 0,
    });
  });
});

describe("netCapitalGains", () => {
  // Other income defaults to $100,000 so that it never limits the deduction
  const net = (
    overrides: Partial<Parameters<typeof netCapitalGains>[0]>,
    filingStatus: Parameters<typeof netCapitalGains>[1] = "single",
    otherIncome = 100000,
  ) =>
    netCapitalGains(
      {
        longTermCapitalGains: 0,
        priorYearLongTermLossCarryover: 0,
        priorYearShortTermLossCarryover: 0,
        shortTermCapitalGains: 0,
        ...overrides,
      },
      filingStatus,
      sharedLimits,
      otherIncome,
    );

  describe("no losses", () => {
    it("passes gains through unchanged", () => {
      expect(
        net({ longTermCapitalGains: 30000, shortTermCapitalGains: 10000 }),
      ).toEqual({
        longTermGains: 30000,
        longTermLossOffset: 0,
        longTermLossUnused: 0,
        netLongTermGain: 30000,
        netShortTermGain: 10000,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 10000,
        shortTermLossOffset: 0,
        shortTermLossUnused: 0,
      });
    });

    it("returns zeros when there are no gains, losses or carryovers", () => {
      expect(net({})).toEqual({
        longTermGains: 0,
        longTermLossOffset: 0,
        longTermLossUnused: 0,
        netLongTermGain: 0,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 0,
        shortTermLossOffset: 0,
        shortTermLossUnused: 0,
      });
    });

    it("ignores a carryover entered as a negative number", () => {
      const result = net({
        longTermCapitalGains: 30000,
        priorYearLongTermLossCarryover: -5000,
        priorYearShortTermLossCarryover: -5000,
        shortTermCapitalGains: 10000,
      });

      expect(result.netLongTermGain).toBe(30000);
      expect(result.netShortTermGain).toBe(10000);
      expect(result.longTermLossOffset).toBe(0);
      expect(result.shortTermLossOffset).toBe(0);
    });
  });

  describe("same-term netting", () => {
    it("offsets short-term gains with a short-term carryover, leaving long-term gains alone", () => {
      // Short-term: $15,000 gain - $5,000 carryover = $10,000
      // Long-term:  $20,000 gain, untouched
      expect(
        net({
          longTermCapitalGains: 20000,
          priorYearShortTermLossCarryover: 5000,
          shortTermCapitalGains: 15000,
        }),
      ).toEqual({
        longTermGains: 20000,
        longTermLossOffset: 0,
        longTermLossUnused: 0,
        netLongTermGain: 20000,
        netShortTermGain: 10000,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 15000,
        shortTermLossOffset: 5000,
        shortTermLossUnused: 0,
      });
    });

    it("offsets long-term gains with a long-term carryover, leaving short-term gains alone", () => {
      // Long-term:  $25,000 gain - $10,000 carryover = $15,000
      // Short-term: $8,000 gain, untouched
      expect(
        net({
          longTermCapitalGains: 25000,
          priorYearLongTermLossCarryover: 10000,
          shortTermCapitalGains: 8000,
        }),
      ).toEqual({
        longTermGains: 25000,
        longTermLossOffset: 10000,
        longTermLossUnused: 0,
        netLongTermGain: 15000,
        netShortTermGain: 8000,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 8000,
        shortTermLossOffset: 0,
        shortTermLossUnused: 0,
      });
    });

    it("reduces a gain to exactly zero when the carryover equals it", () => {
      // Long-term: $10,000 gain - $10,000 carryover = $0, nothing left over
      const result = net({
        longTermCapitalGains: 10000,
        priorYearLongTermLossCarryover: 10000,
      });

      expect(result.netLongTermGain).toBe(0);
      expect(result.longTermLossOffset).toBe(10000);
      expect(result.longTermLossUnused).toBe(0);
      expect(result.ordinaryIncomeDeduction).toBe(0);
    });
  });

  describe("cross-term netting", () => {
    it("offsets long-term gains with a net short-term loss", () => {
      // Long-term: $30,000 gain - $10,000 short-term loss = $20,000
      expect(
        net({ longTermCapitalGains: 30000, shortTermCapitalGains: -10000 }),
      ).toEqual({
        longTermGains: 30000,
        longTermLossOffset: 0,
        longTermLossUnused: 0,
        netLongTermGain: 20000,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 0,
        shortTermLossOffset: 10000,
        shortTermLossUnused: 0,
      });
    });

    it("offsets short-term gains with a net long-term loss", () => {
      // Short-term: $30,000 gain - $4,000 long-term loss = $26,000
      expect(
        net({ longTermCapitalGains: -4000, shortTermCapitalGains: 30000 }),
      ).toEqual({
        longTermGains: 0,
        longTermLossOffset: 4000,
        longTermLossUnused: 0,
        netLongTermGain: 0,
        netShortTermGain: 26000,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 30000,
        shortTermLossOffset: 0,
        shortTermLossUnused: 0,
      });
    });

    it("adds a current-year loss to a carryover of the same term", () => {
      // Short-term losses: $4,000 this year + $6,000 carryover = $10,000
      // Long-term: $30,000 gain - $10,000 = $20,000
      const result = net({
        longTermCapitalGains: 30000,
        priorYearShortTermLossCarryover: 6000,
        shortTermCapitalGains: -4000,
      });

      expect(result.netLongTermGain).toBe(20000);
      expect(result.shortTermLossOffset).toBe(10000);
      expect(result.shortTermLossUnused).toBe(0);
      expect(result.ordinaryIncomeDeduction).toBe(0);
    });

    it("applies each carryover to gains of its own term before the other term", () => {
      // Short-term: $15,000 gain - $20,000 carryover = $5,000 net loss
      // Long-term:  $25,000 gain - $10,000 carryover = $15,000 net gain
      // Cross-term: $15,000 - $5,000 = $10,000 long-term gain
      expect(
        net({
          longTermCapitalGains: 25000,
          priorYearLongTermLossCarryover: 10000,
          priorYearShortTermLossCarryover: 20000,
          shortTermCapitalGains: 15000,
        }),
      ).toEqual({
        longTermGains: 25000,
        longTermLossOffset: 10000,
        longTermLossUnused: 0,
        netLongTermGain: 10000,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 15000,
        shortTermLossOffset: 20000,
        shortTermLossUnused: 0,
      });
    });

    it("offsets only the long-term gain left after its own carryover with a short-term loss", () => {
      // Long-term:  $10,000 gain - $4,000 carryover = $6,000 net gain
      // Short-term: $20,000 loss; $6,000 of it wipes out the long-term gain
      // Left over:  $20,000 - $6,000 = $14,000; $3,000 deducted, $11,000 unused
      expect(
        net({
          longTermCapitalGains: 10000,
          priorYearLongTermLossCarryover: 4000,
          shortTermCapitalGains: -20000,
        }),
      ).toEqual({
        longTermGains: 10000,
        longTermLossOffset: 4000,
        longTermLossUnused: 0,
        netLongTermGain: 0,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 3000,
        shortTermGains: 0,
        shortTermLossOffset: 9000,
        shortTermLossUnused: 11000,
      });
    });

    it("offsets only the short-term gain left after its own carryover with a long-term loss", () => {
      // Short-term: $10,000 gain - $4,000 carryover = $6,000 net gain
      // Long-term:  $20,000 loss; $6,000 of it wipes out the short-term gain
      // Left over:  $20,000 - $6,000 = $14,000; $3,000 deducted, $11,000 unused
      expect(
        net({
          longTermCapitalGains: -20000,
          priorYearShortTermLossCarryover: 4000,
          shortTermCapitalGains: 10000,
        }),
      ).toEqual({
        longTermGains: 0,
        longTermLossOffset: 9000,
        longTermLossUnused: 11000,
        netLongTermGain: 0,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 3000,
        shortTermGains: 10000,
        shortTermLossOffset: 4000,
        shortTermLossUnused: 0,
      });
    });

    it("offsets short-term gains with only the long-term loss left after long-term gains", () => {
      // Long-term:  $10,000 gain - $14,000 carryover = $4,000 net loss
      // Short-term: $30,000 gain - $4,000 = $26,000
      expect(
        net({
          longTermCapitalGains: 10000,
          priorYearLongTermLossCarryover: 14000,
          shortTermCapitalGains: 30000,
        }),
      ).toEqual({
        longTermGains: 10000,
        longTermLossOffset: 14000,
        longTermLossUnused: 0,
        netLongTermGain: 0,
        netShortTermGain: 26000,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 30000,
        shortTermLossOffset: 0,
        shortTermLossUnused: 0,
      });
    });

    it("offsets long-term gains with only the short-term loss left after short-term gains", () => {
      // Short-term: $10,000 gain - $14,000 carryover = $4,000 net loss
      // Long-term:  $30,000 gain - $4,000 = $26,000
      expect(
        net({
          longTermCapitalGains: 30000,
          priorYearShortTermLossCarryover: 14000,
          shortTermCapitalGains: 10000,
        }),
      ).toEqual({
        longTermGains: 30000,
        longTermLossOffset: 0,
        longTermLossUnused: 0,
        netLongTermGain: 26000,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 0,
        shortTermGains: 10000,
        shortTermLossOffset: 14000,
        shortTermLossUnused: 0,
      });
    });
  });

  describe("deduction against other income", () => {
    it("deducts a net loss smaller than the limit in full", () => {
      // $1,000 loss is under the $3,000 limit, so nothing carries over
      const result = net({ shortTermCapitalGains: -1000 });

      expect(result.ordinaryIncomeDeduction).toBe(1000);
      expect(result.shortTermLossOffset).toBe(1000);
      expect(result.shortTermLossUnused).toBe(0);
    });

    it("deducts a net loss of exactly $3,000 in full", () => {
      const result = net({ shortTermCapitalGains: -3000 });

      expect(result.ordinaryIncomeDeduction).toBe(3000);
      expect(result.shortTermLossUnused).toBe(0);
    });

    it("limits the deduction to $3,000 and carries over the dollar above it", () => {
      // $3,001 loss - $3,000 limit = $1 carried over
      const result = net({ shortTermCapitalGains: -3001 });

      expect(result.ordinaryIncomeDeduction).toBe(3000);
      expect(result.shortTermLossOffset).toBe(3000);
      expect(result.shortTermLossUnused).toBe(1);
    });

    it("uses the $3,000 limit for married filing jointly", () => {
      // $10,000 loss - $3,000 limit = $7,000 carried over
      const result = net(
        { priorYearShortTermLossCarryover: 10000 },
        "marriedFilingJointly",
      );

      expect(result.ordinaryIncomeDeduction).toBe(3000);
      expect(result.shortTermLossUnused).toBe(7000);
    });

    it("deducts a net loss of exactly $1,500 in full for married filing separately", () => {
      const result = net(
        { shortTermCapitalGains: -1500 },
        "marriedFilingSeparately",
      );

      expect(result.ordinaryIncomeDeduction).toBe(1500);
      expect(result.shortTermLossUnused).toBe(0);
    });

    it("limits the deduction to $1,500 for married filing separately", () => {
      // $1,501 loss - $1,500 limit = $1 carried over
      const result = net(
        { shortTermCapitalGains: -1501 },
        "marriedFilingSeparately",
      );

      expect(result.ordinaryIncomeDeduction).toBe(1500);
      expect(result.shortTermLossUnused).toBe(1);
    });

    it("applies the limit to the loss left after gains are offset", () => {
      // Long-term: $10,000 gain - $18,000 carryover = $8,000 net loss
      // Deducted: $3,000; carried over: $8,000 - $3,000 = $5,000
      // Losses used: $10,000 against the gain + $3,000 deducted = $13,000
      expect(
        net({
          longTermCapitalGains: 10000,
          priorYearLongTermLossCarryover: 18000,
        }),
      ).toEqual({
        longTermGains: 10000,
        longTermLossOffset: 13000,
        longTermLossUnused: 5000,
        netLongTermGain: 0,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 3000,
        shortTermGains: 0,
        shortTermLossOffset: 0,
        shortTermLossUnused: 0,
      });
    });

    it("uses short-term losses before long-term losses", () => {
      // $3,000 limit: $2,000 short-term first, then $1,000 long-term
      // Long-term carried over: $5,000 - $1,000 = $4,000
      expect(
        net({
          priorYearLongTermLossCarryover: 5000,
          priorYearShortTermLossCarryover: 2000,
        }),
      ).toEqual({
        longTermGains: 0,
        longTermLossOffset: 1000,
        longTermLossUnused: 4000,
        netLongTermGain: 0,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 3000,
        shortTermGains: 0,
        shortTermLossOffset: 2000,
        shortTermLossUnused: 0,
      });
    });

    it("uses no long-term loss when short-term losses alone reach the limit", () => {
      // $3,000 limit is used up by the $4,000 short-term loss
      // Carried over: $1,000 short-term and all $5,000 long-term
      expect(
        net({
          priorYearLongTermLossCarryover: 5000,
          priorYearShortTermLossCarryover: 4000,
        }),
      ).toEqual({
        longTermGains: 0,
        longTermLossOffset: 0,
        longTermLossUnused: 5000,
        netLongTermGain: 0,
        netShortTermGain: 0,
        ordinaryIncomeDeduction: 3000,
        shortTermGains: 0,
        shortTermLossOffset: 3000,
        shortTermLossUnused: 1000,
      });
    });
  });

  describe("other income below the limit", () => {
    it("carries over the whole loss when there is no other income", () => {
      const result = net({ shortTermCapitalGains: -5000 }, "single", 0);

      expect(result.ordinaryIncomeDeduction).toBe(0);
      expect(result.shortTermLossOffset).toBe(0);
      expect(result.shortTermLossUnused).toBe(5000);
    });

    it("treats negative other income as none", () => {
      const result = net({ shortTermCapitalGains: -5000 }, "single", -4000);

      expect(result.ordinaryIncomeDeduction).toBe(0);
      expect(result.shortTermLossUnused).toBe(5000);
    });

    it("deducts no more than the other income there is", () => {
      // $2,000 of other income is under the $3,000 limit
      // Carried over: $5,000 - $2,000 = $3,000
      const result = net({ shortTermCapitalGains: -5000 }, "single", 2000);

      expect(result.ordinaryIncomeDeduction).toBe(2000);
      expect(result.shortTermLossUnused).toBe(3000);
    });

    it("still offsets gains in full, whatever the other income", () => {
      // Long-term: $30,000 gain - $10,000 short-term loss = $20,000
      const result = net(
        { longTermCapitalGains: 30000, shortTermCapitalGains: -10000 },
        "single",
        0,
      );

      expect(result.netLongTermGain).toBe(20000);
      expect(result.shortTermLossOffset).toBe(10000);
      expect(result.shortTermLossUnused).toBe(0);
    });
  });
});

describe("splitDividends", () => {
  it("separates qualified from non-qualified dividends", () => {
    // $20,000 total - $15,000 qualified = $5,000 non-qualified
    expect(
      splitDividends({ ordinaryDividends: 20000, qualifiedDividends: 15000 }),
    ).toEqual({ ordinary: 20000, qualified: 15000, nonQualified: 5000 });
  });

  it("treats all dividends as non-qualified when none are qualified", () => {
    expect(
      splitDividends({ ordinaryDividends: 20000, qualifiedDividends: 0 }),
    ).toEqual({ ordinary: 20000, qualified: 0, nonQualified: 20000 });
  });

  it("limits qualified dividends to the ordinary total", () => {
    // Qualified dividends are part of the total, so $25,000 is cut to $10,000
    expect(
      splitDividends({ ordinaryDividends: 10000, qualifiedDividends: 25000 }),
    ).toEqual({ ordinary: 10000, qualified: 10000, nonQualified: 0 });
  });

  it("ignores negative entries", () => {
    expect(
      splitDividends({ ordinaryDividends: -5000, qualifiedDividends: -2000 }),
    ).toEqual({ ordinary: 0, qualified: 0, nonQualified: 0 });
    expect(
      splitDividends({ ordinaryDividends: 5000, qualifiedDividends: -2000 }),
    ).toEqual({ ordinary: 5000, qualified: 0, nonQualified: 5000 });
  });
});

describe("taxableInterest", () => {
  it("returns the interest entered", () => {
    expect(taxableInterest({ interestIncome: 5000 })).toBe(5000);
  });

  it("ignores a negative entry", () => {
    expect(taxableInterest({ interestIncome: -5000 })).toBe(0);
  });
});

describe("stateTaxableInterest", () => {
  it("removes the U.S. Treasury portion", () => {
    // $20,000 - $12,000 = $8,000
    expect(
      stateTaxableInterest({ interestIncome: 20000, treasuryInterest: 12000 }),
    ).toBe(8000);
  });

  it("returns all interest when none is from Treasuries", () => {
    expect(
      stateTaxableInterest({ interestIncome: 5000, treasuryInterest: 0 }),
    ).toBe(5000);
  });

  it("returns zero when all interest is from Treasuries", () => {
    expect(
      stateTaxableInterest({ interestIncome: 5000, treasuryInterest: 5000 }),
    ).toBe(0);
  });

  it("ignores Treasury interest above total interest", () => {
    expect(
      stateTaxableInterest({ interestIncome: 5000, treasuryInterest: 9000 }),
    ).toBe(0);
  });

  it("ignores a negative Treasury entry", () => {
    expect(
      stateTaxableInterest({ interestIncome: 5000, treasuryInterest: -2000 }),
    ).toBe(5000);
  });
});

describe("calculateEffectiveRate", () => {
  it("divides tax by income", () => {
    // $15,000 / $100,000 = 15%
    expect(calculateEffectiveRate(15000, 100000)).toBeCloseTo(0.15, 4);
  });

  it("returns 0 when there is no tax", () => {
    expect(calculateEffectiveRate(0, 100000)).toBe(0);
  });

  it("returns 0 when income is zero", () => {
    expect(calculateEffectiveRate(1000, 0)).toBe(0);
  });

  it("returns 0 when income is negative", () => {
    expect(calculateEffectiveRate(1000, -50000)).toBe(0);
  });
});

describe("calculateEffectiveRates", () => {
  const createMockResult = (
    overrides: Partial<TaxCalculationResult>,
  ): TaxCalculationResult => ({
    wageIncome: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    grossIncome: 0,
    shortTermLossCarryoverOffset: 0,
    longTermLossCarryoverOffset: 0,
    contributions401k: 0,
    preTaxMedical: 0,
    adjustedGrossIncome: 0,
    deductionBreakdown: {
      standardDeduction: 0,
      itemizedDeduction: 0,
      deductionUsed: "standard",
      deductionAmount: 0,
      saltDeduction: 0,
      saltCapped: false,
      mortgageInterest: 0,
      charitableContributions: 0,
    },
    taxableOrdinaryIncome: 0,
    taxableLTCG: 0,
    ordinaryIncomeBracketBreakdown: [],
    ltcgBracketBreakdown: [],
    ordinaryIncomeTax: 0,
    ltcgTax: 0,
    totalTax: 0,
    withheld: 0,
    estimatedPaid: 0,
    totalPaid: 0,
    remainingOwed: 0,
    refundDue: 0,
    ...overrides,
  });

  it("gives the rate on taxable income and the rate on gross income", () => {
    const rates = calculateEffectiveRates(
      createMockResult({
        grossIncome: 150000,
        taxableOrdinaryIncome: 120000,
        totalTax: 18000,
      }),
    );

    // $18,000 / $120,000 taxable = 15%
    expect(rates.onTaxableIncome).toBeCloseTo(0.15, 4);
    // $18,000 / $150,000 gross = 12%
    expect(rates.onGrossIncome).toBeCloseTo(0.12, 4);
  });

  it("counts income taxed at long-term rates as taxable income", () => {
    const rates = calculateEffectiveRates(
      createMockResult({
        grossIncome: 200000,
        taxableOrdinaryIncome: 100000,
        taxableLTCG: 50000,
        totalTax: 22500,
      }),
    );

    // $22,500 / ($100,000 + $50,000) = 15%
    expect(rates.onTaxableIncome).toBeCloseTo(0.15, 4);
    // $22,500 / $200,000 = 11.25%
    expect(rates.onGrossIncome).toBeCloseTo(0.1125, 4);
  });

  it("returns 0 for the rate on taxable income when deductions leave none", () => {
    const rates = calculateEffectiveRates(
      createMockResult({
        grossIncome: 15000,
        totalTax: 1500,
      }),
    );

    expect(rates.onTaxableIncome).toBe(0);
    // $1,500 / $15,000 = 10%
    expect(rates.onGrossIncome).toBeCloseTo(0.1, 4);
  });

  it("returns 0 for both rates when there is no income", () => {
    const rates = calculateEffectiveRates(createMockResult({}));

    expect(rates.onTaxableIncome).toBe(0);
    expect(rates.onGrossIncome).toBe(0);
  });
});
