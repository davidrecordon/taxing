import { describe, it, expect, beforeAll } from "vitest";
import { calculateFederalTax } from "../federalTaxCalculator";
import {
  federalBrackets,
  ltcgBrackets,
  federalDeductions,
  sharedLimits,
  federalLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import { DeductionChoice, TaxInputs } from "../types";

// Figures used throughout (2026, the default tax year):
//
// Ordinary schedule   Single             Married jointly    Married separately
//   10%               $0                 $0                 $0
//   12%               $12,400            $24,800            $12,400
//   22%               $50,400            $100,800           $50,400
//   24%               $105,700           $211,400           $105,700
//   32%               $201,775           $403,550           $201,775
//   35%               $256,225           $512,450           $256,225
//   37%               $640,600           $768,700           $384,350
// Long-term schedule
//   15% from          $49,450            $98,900            $49,450
//   20% from          $545,500           $613,700           $306,850
// Standard deduction  $16,100            $32,200            $16,100
//
// Social Security wage base: $184,500

const calculate = (
  overrides: Partial<TaxInputs> = {},
  deductionChoice?: DeductionChoice,
) =>
  calculateFederalTax(
    createDefaultInputs(overrides),
    federalBrackets,
    ltcgBrackets,
    federalDeductions,
    sharedLimits,
    federalLimits,
    ficaData,
    deductionChoice,
  );

// The payroll tax data is an optional argument. Without it there is no
// self-employment tax, so no deductible half, and business income reaches
// taxable income in whole dollars. Tests that need to land exactly on a
// threshold use this.
const calculateWithoutPayrollData = (
  overrides: Partial<TaxInputs> = {},
  deductionChoice?: DeductionChoice,
) =>
  calculateFederalTax(
    createDefaultInputs(overrides),
    federalBrackets,
    ltcgBrackets,
    federalDeductions,
    sharedLimits,
    federalLimits,
    undefined,
    deductionChoice,
  );

describe("calculateFederalTax", () => {
  describe("worked examples", () => {
    it("single: $150,000 wages, $50,000 long-term gain and $23,500 to a 401(k) owe $26,594", () => {
      // Gross income: $150,000 + $50,000 = $200,000
      // AGI: $200,000 - $23,500 = $176,500
      //
      // Taxable ordinary income: $150,000 - $23,500 - $16,100 = $110,400
      //   $12,400 @ 10%                       =  $1,240
      //   $38,000 ($50,400 - $12,400) @ 12%   =  $4,560
      //   $55,300 ($105,700 - $50,400) @ 22%  = $12,166
      //   $4,700 ($110,400 - $105,700) @ 24%  =  $1,128
      //   Ordinary income tax                 = $19,094
      //
      // Long-term gain: $50,000 stacked from $110,400 to $160,400, all in
      // the 15% band = $7,500
      //
      // NIIT: AGI $176,500 is under $200,000 = $0
      //
      // Total tax: $19,094 + $7,500 = $26,594
      // Paid: $25,000 withheld. Owed: $26,594 - $25,000 = $1,594
      //
      // Payroll tax (information only): $150,000 x 6.2% = $9,300 Social
      // Security + $150,000 x 1.45% = $2,175 Medicare = $11,475
      const result = calculate({
        federalIncome: 150000,
        longTermCapitalGains: 50000,
        contributions401k: 23500,
        federalTaxWithheld: 25000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(200000);
      expect(result.adjustedGrossIncome).toBe(176500);
      expect(result.deductionBreakdown.deductionUsed).toBe("standard");
      expect(result.deductionBreakdown.deductionAmount).toBe(16100);

      expect(result.taxableOrdinaryIncome).toBe(110400);
      expect(result.ordinaryIncomeTax).toBe(19094);
      expect(result.taxableLTCG).toBe(50000);
      expect(result.ltcgTax).toBe(7500);
      expect(result.niitBreakdown).toBeUndefined();

      expect(result.totalTax).toBe(26594);
      expect(result.totalPaid).toBe(25000);
      expect(result.remainingOwed).toBe(1594);
      expect(result.refundDue).toBe(0);

      expect(result.ficaBreakdown!.socialSecurityTax).toBe(9300);
      expect(result.ficaBreakdown!.medicareTax).toBe(2175);
      expect(result.ficaBreakdown!.totalFica).toBe(11475);
    });

    it("married filing jointly: $500,000 wages, $20,000 interest and a $100,000 long-term gain owe $130,818", () => {
      // Gross income and AGI: $500,000 + $20,000 + $100,000 = $620,000
      //
      // Taxable ordinary income: $500,000 + $20,000 - $32,200 = $487,800
      //   $24,800 @ 10%                         =   $2,480
      //   $76,000 ($100,800 - $24,800) @ 12%    =   $9,120
      //   $110,600 ($211,400 - $100,800) @ 22%  =  $24,332
      //   $192,150 ($403,550 - $211,400) @ 24%  =  $46,116
      //   $84,250 ($487,800 - $403,550) @ 32%   =  $26,960
      //   Ordinary income tax                   = $109,008
      //
      // Long-term gain: $100,000 stacked from $487,800 to $587,800, all in
      // the 15% band (which ends at $613,700) = $15,000
      //
      // NIIT: AGI is $620,000 - $250,000 = $370,000 over the threshold
      //   Net investment income: $20,000 + $100,000 = $120,000
      //   3.8% x the lesser, $120,000 = $4,560
      //
      // Payroll tax, all wages one earner's:
      //   Social Security: $184,500 x 6.2%                  = $11,439
      //   Medicare: $500,000 x 1.45%                        =  $7,250
      //   Additional Medicare: ($500,000 - $250,000) x 0.9% =  $2,250
      //   Total                                             = $20,939
      //   Withheld toward Additional Medicare, above $200,000 of the one
      //   earner's wages: $300,000 x 0.9%                   =  $2,700
      //
      // Total tax: $109,008 + $15,000 + $4,560 + $2,250 = $130,818
      // Paid: $110,000 withheld + $2,700 Additional Medicare withheld
      //   + $10,000 estimated = $122,700
      // Owed: $130,818 - $122,700 = $8,118
      //
      // Safe harbor: the lesser of 90% x $130,818 = $117,736.20 and
      // 110% x last year's $100,000 = $110,000. $122,700 paid meets it.
      const result = calculate({
        federalIncome: 500000,
        interestIncome: 20000,
        longTermCapitalGains: 100000,
        federalTaxWithheld: 110000,
        federalEstimatedPaid: 10000,
        priorYearFederalTax: 100000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.grossIncome).toBe(620000);
      expect(result.adjustedGrossIncome).toBe(620000);
      expect(result.deductionBreakdown.deductionAmount).toBe(32200);

      expect(result.taxableOrdinaryIncome).toBe(487800);
      expect(result.ordinaryIncomeTax).toBeCloseTo(109008, 2);
      expect(result.taxableLTCG).toBe(100000);
      expect(result.ltcgTax).toBeCloseTo(15000, 2);

      expect(result.niitBreakdown!.magiOverThreshold).toBe(370000);
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(120000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(4560, 2);

      expect(result.totalTax).toBeCloseTo(130818, 2);
      expect(result.additionalMedicareWithheld).toBeCloseTo(2700, 2);
      expect(result.totalPaid).toBeCloseTo(122700, 2);
      expect(result.remainingOwed).toBeCloseTo(8118, 2);
      expect(result.refundDue).toBe(0);

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(117736.2, 2);
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(110000, 2);
      expect(result.safeHarbor!.minimum).toBeCloseTo(110000, 2);
      expect(result.safeHarbor!.met).toBe(true);

      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(11439, 2);
      expect(result.ficaBreakdown!.medicareTax).toBeCloseTo(7250, 2);
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(2250, 2);
      expect(result.ficaBreakdown!.additionalMedicareWithheld).toBeCloseTo(2700, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(20939, 2);
    });

    it("married filing separately: wages, interest, dividends, gains and loss carryovers come to $66,519.50", () => {
      // $180,000 wages, $10,000 interest, $150,000 dividends of which
      // $120,000 are qualified, a $30,000 short-term gain, a $4,000
      // long-term loss, and carryovers of $20,000 short-term and $50,000
      // long-term.
      //
      // Gains and losses:
      //   Short-term: $30,000 - $20,000 carryover = $10,000 net gain
      //   Long-term: -$4,000 - $50,000 carryover  = $54,000 net loss
      //   The long-term loss absorbs the $10,000 short-term gain, leaving a
      //   $44,000 loss: $1,500 is deductible (married filing separately)
      //   and $42,500 carries over.
      //   Long-term loss used: $10,000 + $1,500 = $11,500
      //
      // Gross income: $180,000 + $10,000 + $150,000 + $30,000 = $370,000
      // AGI: $370,000 - $20,000 - $11,500 of losses used = $338,500
      //
      // Taxable ordinary income: $180,000 wages + $10,000 interest
      //   + $30,000 non-qualified dividends - $1,500 loss - $16,100
      //   = $202,400
      //   $12,400 @ 10%                         =  $1,240
      //   $38,000 @ 12%                         =  $4,560
      //   $55,300 @ 22%                         = $12,166
      //   $96,075 ($201,775 - $105,700) @ 24%   = $23,058
      //   $625 ($202,400 - $201,775) @ 32%      =    $200
      //   Ordinary income tax                   = $41,224
      //
      // Qualified dividends: $120,000 stacked from $202,400 to $322,400
      //   $104,450 ($306,850 - $202,400) @ 15%  = $15,667.50
      //   $15,550 ($322,400 - $306,850) @ 20%   =  $3,110.00
      //   Tax at long-term rates                = $18,777.50
      //
      // NIIT: AGI is $338,500 - $125,000 = $213,500 over the threshold
      //   Net investment income: $10,000 + $150,000 - $1,500 = $158,500
      //   3.8% x the lesser, $158,500 = $6,023
      //
      // Additional Medicare: ($180,000 - $125,000) x 0.9% = $495. Nothing
      // is withheld toward it: the wages are under $200,000.
      //
      // Total tax: $41,224 + $18,777.50 + $6,023 + $495 = $66,519.50
      // Paid: $60,000 withheld + $10,000 estimated = $70,000
      // Refund: $70,000 - $66,519.50 = $3,480.50
      //
      // Payroll tax:
      //   Social Security: $180,000 x 6.2%                  = $11,160
      //   Medicare: $180,000 x 1.45%                        =  $2,610
      //   Additional Medicare: ($180,000 - $125,000) x 0.9% =    $495
      //   Total                                             = $14,265
      const result = calculate({
        federalIncome: 180000,
        interestIncome: 10000,
        ordinaryDividends: 150000,
        qualifiedDividends: 120000,
        shortTermCapitalGains: 30000,
        longTermCapitalGains: -4000,
        priorYearShortTermLossCarryover: 20000,
        priorYearLongTermLossCarryover: 50000,
        federalTaxWithheld: 60000,
        federalEstimatedPaid: 10000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.shortTermLossCarryoverOffset).toBe(20000);
      expect(result.shortTermLossCarryoverUnused).toBe(0);
      expect(result.longTermLossCarryoverOffset).toBe(11500);
      expect(result.longTermLossCarryoverUnused).toBe(42500);

      expect(result.grossIncome).toBe(370000);
      expect(result.adjustedGrossIncome).toBe(338500);

      expect(result.taxableOrdinaryIncome).toBe(202400);
      expect(result.ordinaryIncomeTax).toBeCloseTo(41224, 2);
      expect(result.taxableLTCG).toBe(120000);
      expect(result.ltcgTax).toBeCloseTo(18777.5, 2);

      expect(result.niitBreakdown!.magiOverThreshold).toBe(213500);
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(158500);
      expect(result.niitBreakdown!.tax).toBeCloseTo(6023, 2);

      expect(result.totalTax).toBeCloseTo(66519.5, 2);
      expect(result.additionalMedicareWithheld).toBeUndefined();
      expect(result.totalPaid).toBe(70000);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBeCloseTo(3480.5, 2);

      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(495, 2);
      expect(result.ficaBreakdown!.additionalMedicareWithheld).toBe(0);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(14265, 2);
    });

    it("single: $120,000 of self-employment income owes $28,461.78", () => {
      // Self-employment tax:
      //   Net earnings: $120,000 x 92.35%   = $110,820
      //   Social Security: $110,820 x 12.4% =  $13,741.68
      //   Medicare: $110,820 x 2.9%         =   $3,213.78
      //   Self-employment tax               =  $16,955.46
      //   Deductible half                   =   $8,477.73
      //
      // Gross income: $120,000
      // AGI: $120,000 - $8,477.73 = $111,522.27
      // Taxable income before the QBI deduction:
      //   $111,522.27 - $16,100 = $95,422.27
      //
      // QBI deduction: the lesser of
      //   20% x ($120,000 business income - $8,477.73) = $22,304.454
      //   20% x $95,422.27 of taxable income           = $19,084.454
      //
      // Taxable ordinary income: $95,422.27 - $19,084.454 = $76,337.816
      //   $12,400 @ 10%                             =  $1,240
      //   $38,000 @ 12%                             =  $4,560
      //   $25,937.816 ($76,337.816 - $50,400) @ 22% =  $5,706.32
      //   Ordinary income tax                       = $11,506.32
      //
      // Total tax: $11,506.32 + $16,955.46 = $28,461.78
      // Paid: $25,000 estimated. Owed: $3,461.78
      //
      // Safe harbor: the lesser of 90% x $28,461.78 = $25,615.60 and 100%
      // of last year's $20,000 (last year's income was not over $150,000)
      // = $20,000. $25,000 paid meets it.
      const result = calculate({
        selfEmploymentIncome: 120000,
        federalEstimatedPaid: 25000,
        priorYearFederalTax: 20000,
        priorYearIncomeOverThreshold: false,
        filingStatus: "single",
      });

      const seTax = result.selfEmploymentTaxBreakdown!;
      expect(seTax.netEarnings).toBeCloseTo(110820, 2);
      expect(seTax.socialSecurityTax).toBeCloseTo(13741.68, 2);
      expect(seTax.medicareTax).toBeCloseTo(3213.78, 2);
      expect(seTax.totalSETax).toBeCloseTo(16955.46, 2);
      expect(seTax.deductibleHalf).toBeCloseTo(8477.73, 2);

      expect(result.grossIncome).toBe(120000);
      expect(result.adjustedGrossIncome).toBeCloseTo(111522.27, 2);

      expect(result.qbiDeduction!.tentativeDeduction).toBeCloseTo(22304.454, 2);
      expect(result.qbiDeduction!.taxableIncomeLimit).toBeCloseTo(19084.454, 2);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(19084.454, 2);
      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);

      expect(result.taxableOrdinaryIncome).toBeCloseTo(76337.816, 2);
      expect(result.ordinaryIncomeTax).toBeCloseTo(11506.32, 2);
      expect(result.ltcgTax).toBe(0);

      expect(result.totalTax).toBeCloseTo(28461.78, 2);
      expect(result.remainingOwed).toBeCloseTo(3461.78, 2);

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(25615.6, 2);
      expect(result.safeHarbor!.minimum).toBe(20000);
      expect(result.safeHarbor!.met).toBe(true);

      // No wages, so no payroll tax
      expect(result.ficaBreakdown!.totalFica).toBe(0);
    });
  });

  describe("ordinary income schedule", () => {
    it("taxes $100,000 of wages for a single filer at 10%, 12% and 22%", () => {
      // Taxable: $100,000 - $16,100 = $83,900
      //   $12,400 @ 10%                      =  $1,240
      //   $38,000 ($50,400 - $12,400) @ 12%  =  $4,560
      //   $33,500 ($83,900 - $50,400) @ 22%  =  $7,370
      //   Tax                                = $13,170
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(83900);
      expect(result.ordinaryIncomeTax).toBe(13170);
      expect(result.totalTax).toBe(13170);
    });

    it("walks all seven single brackets for $1,000,000 of wages", () => {
      // Taxable: $1,000,000 - $16,100 = $983,900
      //   $12,400 @ 10%                         =   $1,240.00
      //   $38,000 ($50,400 - $12,400) @ 12%     =   $4,560.00
      //   $55,300 ($105,700 - $50,400) @ 22%    =  $12,166.00
      //   $96,075 ($201,775 - $105,700) @ 24%   =  $23,058.00
      //   $54,450 ($256,225 - $201,775) @ 32%   =  $17,424.00
      //   $384,375 ($640,600 - $256,225) @ 35%  = $134,531.25
      //   $343,300 ($983,900 - $640,600) @ 37%  = $127,021.00
      //   Tax                                   = $320,000.25
      const result = calculate({
        federalIncome: 1000000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(983900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(320000.25, 2);
    });

    it("walks all seven married filing jointly brackets for $1,000,000 of wages", () => {
      // Taxable: $1,000,000 - $32,200 = $967,800
      //   $24,800 @ 10%                         =   $2,480.00
      //   $76,000 ($100,800 - $24,800) @ 12%    =   $9,120.00
      //   $110,600 ($211,400 - $100,800) @ 22%  =  $24,332.00
      //   $192,150 ($403,550 - $211,400) @ 24%  =  $46,116.00
      //   $108,900 ($512,450 - $403,550) @ 32%  =  $34,848.00
      //   $256,250 ($768,700 - $512,450) @ 35%  =  $89,687.50
      //   $199,100 ($967,800 - $768,700) @ 37%  =  $73,667.00
      //   Tax                                   = $280,250.50
      const result = calculate({
        federalIncome: 1000000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.taxableOrdinaryIncome).toBe(967800);
      expect(result.ordinaryIncomeTax).toBeCloseTo(280250.5, 2);
    });

    it("walks all seven married filing separately brackets, where 37% starts at $384,350", () => {
      // Taxable: $1,000,000 - $16,100 = $983,900
      //   $12,400 @ 10%                         =   $1,240.00
      //   $38,000 @ 12%                         =   $4,560.00
      //   $55,300 @ 22%                         =  $12,166.00
      //   $96,075 @ 24%                         =  $23,058.00
      //   $54,450 @ 32%                         =  $17,424.00
      //   $128,125 ($384,350 - $256,225) @ 35%  =  $44,843.75
      //   $599,550 ($983,900 - $384,350) @ 37%  = $221,833.50
      //   Tax                                   = $325,125.25
      const result = calculate({
        federalIncome: 1000000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.taxableOrdinaryIncome).toBe(983900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(325125.25, 2);
    });

    it("taxes nothing when wages equal the $16,100 standard deduction", () => {
      const result = calculate({
        federalIncome: 16100,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("taxes the first dollar of wages over the standard deduction at 10%", () => {
      // $16,101 - $16,100 = $1 taxable, x 10% = $0.10
      const result = calculate({
        federalIncome: 16101,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(1);
      expect(result.ordinaryIncomeTax).toBeCloseTo(0.1, 2);
    });
  });

  describe("ordinary income and income taxed at long-term rates", () => {
    it("taxes wages, interest, non-qualified dividends and short-term gains as ordinary income, and qualified dividends and long-term gains at long-term rates", () => {
      // $100,000 wages, $5,000 interest, $20,000 dividends of which $15,000
      // are qualified, a $10,000 short-term gain and a $30,000 long-term gain
      //
      // Gross income: $100,000 + $5,000 + $20,000 + $10,000 + $30,000
      //   = $165,000
      // Ordinary: $100,000 + $5,000 + $5,000 + $10,000 - $16,100 = $103,900
      //   $12,400 @ 10% + $38,000 @ 12% + $53,500 @ 22%
      //   = $1,240 + $4,560 + $11,770 = $17,570
      // Long-term rates: $15,000 + $30,000 = $45,000, stacked from $103,900
      //   to $148,900, all at 15% = $6,750
      const result = calculate({
        federalIncome: 100000,
        interestIncome: 5000,
        ordinaryDividends: 20000,
        qualifiedDividends: 15000,
        shortTermCapitalGains: 10000,
        longTermCapitalGains: 30000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(165000);
      expect(result.taxableOrdinaryIncome).toBe(103900);
      expect(result.ordinaryIncomeTax).toBe(17570);
      expect(result.taxableLTCG).toBe(45000);
      expect(result.ltcgTax).toBe(6750);
    });

    it("taxes U.S. Treasury interest like any other interest", () => {
      // Treasury interest is part of the interest entered and is exempt
      // only from state tax.
      // $100,000 + $10,000 - $16,100 = $93,900
      //   $1,240 + $4,560 + $43,500 @ 22% ($9,570) = $15,370
      const result = calculate({
        federalIncome: 100000,
        interestIncome: 10000,
        treasuryInterest: 10000,
        filingStatus: "single",
      });

      expect(result.interestIncome).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(93900);
      expect(result.ordinaryIncomeTax).toBe(15370);
    });

    it("takes the deduction off ordinary income first and the $6,100 left over off the long-term gain", () => {
      // $10,000 wages - $16,100 leaves $6,100 of the deduction unused
      // $50,000 long-term gain - $6,100 = $43,900, all in the 0% band
      const result = calculate({
        federalIncome: 10000,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(43900);
      expect(result.ltcgTax).toBe(0);
    });

    it("leaves the long-term gain whole when ordinary income exactly absorbs the deduction", () => {
      // $16,100 wages - $16,100 = $0, nothing left over
      const result = calculate({
        federalIncome: 16100,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(50000);
    });

    it("takes one dollar off the long-term gain when ordinary income is a dollar short of the deduction", () => {
      // $16,099 wages - $16,100 leaves $1; $50,000 - $1 = $49,999
      const result = calculate({
        federalIncome: 16099,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(49999);
    });

    it("takes the leftover deduction off qualified dividends too", () => {
      // No ordinary income: $40,000 qualified dividends - $16,100 = $23,900
      const result = calculate({
        ordinaryDividends: 40000,
        qualifiedDividends: 40000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(23900);
    });

    it("taxes nothing when the deduction exceeds all income", () => {
      // $5,000 wages + $5,000 long-term gain is under $16,100
      const result = calculate({
        federalIncome: 5000,
        longTermCapitalGains: 5000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("does not offset qualified dividends with a capital loss beyond the $3,000 deduction", () => {
      // $100,000 long-term loss carryover, no gains: $3,000 comes off
      // ordinary income and $97,000 carries over. The $50,000 of qualified
      // dividends is untouched.
      // Ordinary: $100,000 - $3,000 - $16,100 = $80,900
      const result = calculate({
        federalIncome: 100000,
        ordinaryDividends: 50000,
        qualifiedDividends: 50000,
        priorYearLongTermLossCarryover: 100000,
        filingStatus: "single",
      });

      expect(result.taxableLTCG).toBe(50000);
      expect(result.taxableOrdinaryIncome).toBe(80900);
      expect(result.longTermLossCarryoverUnused).toBe(97000);
    });

    it("uses the single long-term schedule: 0% to $49,450, 15% to $545,500, then 20%", () => {
      // $600,000 long-term gain - $16,100 = $583,900
      //   $49,450 @ 0%                          =      $0
      //   $496,050 ($545,500 - $49,450) @ 15%   = $74,407.50
      //   $38,400 ($583,900 - $545,500) @ 20%   =  $7,680.00
      //   Tax at long-term rates                = $82,087.50
      const result = calculate({
        longTermCapitalGains: 600000,
        filingStatus: "single",
      });

      expect(result.taxableLTCG).toBe(583900);
      expect(result.ltcgTax).toBeCloseTo(82087.5, 2);
    });

    it("uses the married filing jointly long-term schedule: 0% to $98,900, 15% to $613,700, then 20%", () => {
      // $700,000 long-term gain - $32,200 = $667,800
      //   $98,900 @ 0%                          =      $0
      //   $514,800 ($613,700 - $98,900) @ 15%   = $77,220
      //   $54,100 ($667,800 - $613,700) @ 20%   = $10,820
      //   Tax at long-term rates                = $88,040
      const result = calculate({
        longTermCapitalGains: 700000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.taxableLTCG).toBe(667800);
      expect(result.ltcgTax).toBeCloseTo(88040, 2);
    });

    it("uses the married filing separately long-term schedule: 0% to $49,450, 15% to $306,850, then 20%", () => {
      // $400,000 long-term gain - $16,100 = $383,900
      //   $49,450 @ 0%                          =      $0
      //   $257,400 ($306,850 - $49,450) @ 15%   = $38,610
      //   $77,050 ($383,900 - $306,850) @ 20%   = $15,410
      //   Tax at long-term rates                = $54,020
      const result = calculate({
        longTermCapitalGains: 400000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.taxableLTCG).toBe(383900);
      expect(result.ltcgTax).toBeCloseTo(54020, 2);
    });
  });

  describe("adjusted gross income", () => {
    it("subtracts 401(k) contributions and pre-tax medical premiums, but not the standard deduction", () => {
      // Gross income: $100,000 + $10,000 = $110,000
      // AGI: $110,000 - $20,000 - $2,000 = $88,000
      // Both come off ordinary income:
      //   $100,000 - $20,000 - $2,000 - $16,100 = $61,900
      const result = calculate({
        federalIncome: 100000,
        longTermCapitalGains: 10000,
        contributions401k: 20000,
        preTaxMedical: 2000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(110000);
      expect(result.adjustedGrossIncome).toBe(88000);
      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(2000);
      expect(result.taxableOrdinaryIncome).toBe(61900);
      expect(result.taxableLTCG).toBe(10000);
    });

    it("subtracts the capital losses used this year and reports the rest as carried over", () => {
      // $50,000 long-term carryover: $20,000 offsets the gain, $3,000 is
      // deducted from other income, $27,000 carries over
      // Gross income: $100,000 + $20,000 = $120,000
      // AGI: $120,000 - $23,000 = $97,000
      const result = calculate({
        federalIncome: 100000,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 50000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(120000);
      expect(result.longTermLossCarryoverOffset).toBe(23000);
      expect(result.longTermLossCarryoverUnused).toBe(27000);
      expect(result.adjustedGrossIncome).toBe(97000);
    });

    it("does not count a loss made this year as negative gross income", () => {
      // $10,000 short-term loss: gross income stays at the $100,000 of
      // wages, $3,000 is deducted and $7,000 carries over
      // AGI: $100,000 - $3,000 = $97,000
      // Ordinary: $97,000 - $16,100 = $80,900
      const result = calculate({
        federalIncome: 100000,
        shortTermCapitalGains: -10000,
        filingStatus: "single",
      });

      expect(result.shortTermCapitalGains).toBe(-10000);
      expect(result.grossIncome).toBe(100000);
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(7000);
      expect(result.adjustedGrossIncome).toBe(97000);
      expect(result.taxableOrdinaryIncome).toBe(80900);
    });
  });

  describe("payroll tax on wages", () => {
    it("charges 6.2% Social Security and 1.45% Medicare on $100,000 of wages", () => {
      // $100,000 x 6.2% = $6,200; $100,000 x 1.45% = $1,450; total $7,650
      const fica = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      }).ficaBreakdown!;

      expect(fica.socialSecurityWages).toBe(100000);
      expect(fica.socialSecurityTax).toBeCloseTo(6200, 2);
      expect(fica.medicareTax).toBeCloseTo(1450, 2);
      expect(fica.additionalMedicareTax).toBe(0);
      expect(fica.totalFica).toBeCloseTo(7650, 2);
    });

    it("charges Social Security on all wages of exactly $184,500", () => {
      // $184,500 x 6.2% = $11,439
      const fica = calculate({
        federalIncome: 184500,
        filingStatus: "single",
      }).ficaBreakdown!;

      expect(fica.socialSecurityWages).toBe(184500);
      expect(fica.socialSecurityTax).toBeCloseTo(11439, 2);
    });

    it("charges no Social Security on the dollar of wages over $184,500", () => {
      const fica = calculate({
        federalIncome: 184501,
        filingStatus: "single",
      }).ficaBreakdown!;

      expect(fica.socialSecurityWages).toBe(184500);
      expect(fica.socialSecurityTax).toBeCloseTo(11439, 2);
    });

    it("adds 0.9% Additional Medicare on wages over $200,000 for a single filer", () => {
      // $250,000 of wages:
      //   Social Security: $184,500 x 6.2%                  = $11,439
      //   Medicare: $250,000 x 1.45%                        =  $3,625
      //   Additional Medicare: ($250,000 - $200,000) x 0.9% =    $450
      //   Total                                             = $15,514
      const fica = calculate({
        federalIncome: 250000,
        filingStatus: "single",
      }).ficaBreakdown!;

      expect(fica.socialSecurityTax).toBeCloseTo(11439, 2);
      expect(fica.medicareTax).toBeCloseTo(3625, 2);
      expect(fica.additionalMedicareTax).toBeCloseTo(450, 2);
      expect(fica.totalFica).toBeCloseTo(15514, 2);
    });

    it.each([
      { filingStatus: "single", threshold: 200000 },
      { filingStatus: "marriedFilingJointly", threshold: 250000 },
      { filingStatus: "marriedFilingSeparately", threshold: 125000 },
    ] as const)(
      "starts Additional Medicare one dollar over $threshold of wages for $filingStatus",
      ({ filingStatus, threshold }) => {
        const atThreshold = calculate({
          federalIncome: threshold,
          filingStatus,
        }).ficaBreakdown!;
        const oneDollarOver = calculate({
          federalIncome: threshold + 1,
          filingStatus,
        }).ficaBreakdown!;

        expect(atThreshold.additionalMedicareTax).toBe(0);
        // $1 x 0.9% = $0.009
        expect(oneDollarOver.additionalMedicareTax).toBeCloseTo(0.009, 4);
      },
    );

    it("charges nothing on self-employment income, interest, dividends or capital gains", () => {
      const fica = calculate({
        selfEmploymentIncome: 50000,
        interestIncome: 10000,
        ordinaryDividends: 10000,
        shortTermCapitalGains: 10000,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      }).ficaBreakdown!;

      expect(fica.socialSecurityWages).toBe(0);
      expect(fica.totalFica).toBe(0);
    });

    it("keeps Social Security and Medicare out of the total, and puts Additional Medicare in it with its withholding as a payment", () => {
      // $250,000 of wages, single. Taxable: $250,000 - $16,100 = $233,900
      //   $1,240 + $4,560 + $12,166 + $23,058
      //   + $32,125 ($233,900 - $201,775) @ 32% ($10,280) = $51,304
      // Payroll tax of $15,514: Social Security and Medicare ($15,064) are
      // withheld exactly and stay out of every total. Additional Medicare
      // ($50,000 x 0.9% = $450) is tax on the return; the employer withholds
      // the same $450 above $200,000 of this one earner's wages.
      // Total tax: $51,304 + $450 = $51,754; paid $51,304 + $450
      // Safe harbor: 90% x $51,754 = $46,578.60
      const result = calculate({
        federalIncome: 250000,
        federalTaxWithheld: 51304,
        filingStatus: "single",
      });

      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(15514, 2);
      expect(result.ordinaryIncomeTax).toBeCloseTo(51304, 2);
      expect(result.totalTax).toBeCloseTo(51754, 2);
      expect(result.withheld).toBe(51304);
      expect(result.additionalMedicareWithheld).toBeCloseTo(450, 2);
      expect(result.totalPaid).toBeCloseTo(51754, 2);
      expect(result.remainingOwed).toBeCloseTo(0, 2);
      expect(result.refundDue).toBeCloseTo(0, 2);
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(46578.6, 2);
      expect(result.safeHarbor!.minimum).toBeCloseTo(46578.6, 2);
    });

    it("withholds Additional Medicare per earner, so a two-earner couple comes up short", () => {
      // Joint, $600,000 of wages of which the spouse earned $300,000.
      // Additional Medicare owed: ($600,000 - $250,000) x 0.9% = $3,150
      // Withheld: each earner $100,000 over $200,000 x 0.9% = $900, so $1,800
      // Social Security: each earner capped at $184,500, so $369,000 x 6.2%
      //   = $22,878 on $369,000 of wages
      const fica = calculate({
        federalIncome: 600000,
        spouseWages: 300000,
        filingStatus: "marriedFilingJointly",
      }).ficaBreakdown!;

      expect(fica.additionalMedicareTax).toBeCloseTo(3150, 2);
      expect(fica.additionalMedicareWithheld).toBeCloseTo(1800, 2);
      expect(fica.socialSecurityWages).toBe(369000);
      expect(fica.socialSecurityTax).toBeCloseTo(22878, 2);
      // Medicare is 1.45% of everything either way
      expect(fica.medicareTax).toBeCloseTo(8700, 2);
    });

    it("withholds nothing toward Additional Medicare when neither earner is over $200,000", () => {
      // Joint, $350,000 of wages split $175,000 each: owed ($350,000 -
      // $250,000) x 0.9% = $900, withheld $0, so $900 more is owed than if
      // the wages were one earner's (then $150,000 x 0.9% = $1,350 withheld,
      // $450 over)
      const twoEarners = calculate({
        federalIncome: 350000,
        spouseWages: 175000,
        filingStatus: "marriedFilingJointly",
      });
      const oneEarner = calculate({
        federalIncome: 350000,
        filingStatus: "marriedFilingJointly",
      });

      expect(twoEarners.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(900, 2);
      expect(twoEarners.additionalMedicareWithheld).toBeUndefined();
      expect(oneEarner.additionalMedicareWithheld).toBeCloseTo(1350, 2);
      expect(twoEarners.totalTax).toBeCloseTo(oneEarner.totalTax, 2);
      expect(twoEarners.remainingOwed - oneEarner.remainingOwed).toBeCloseTo(
        1350,
        2,
      );
    });

    it("ignores spouse wages unless the return is joint", () => {
      const fica = calculate({
        federalIncome: 300000,
        spouseWages: 150000,
        filingStatus: "single",
      }).ficaBreakdown!;

      // One earner: ($300,000 - $200,000) x 0.9% = $900 owed and withheld
      expect(fica.additionalMedicareTax).toBeCloseTo(900, 2);
      expect(fica.additionalMedicareWithheld).toBeCloseTo(900, 2);
      expect(fica.socialSecurityWages).toBe(184500);
    });
  });

  describe("self-employment tax on a joint return with two earners", () => {
    it("uses up the Social Security wage base with the first earner's wages only", () => {
      // $200,000 of wages of which the spouse earned $100,000, and $50,000 of
      // business income treated as the first earner's. Their $100,000 of
      // wages leave $84,500 of the $184,500 wage base.
      //   Net earnings: $50,000 x 92.35%            = $46,175
      //   Social Security: $46,175 x 12.4%          =  $5,725.70
      //   Medicare: $46,175 x 2.9%                  =  $1,339.08 (rounded)
      // With one earner on $200,000 of wages the base is used up: $0.
      // Additional Medicare on the business still starts from the couple's
      // combined wages: $250,000 - $200,000 leaves $50,000 of room, over
      // $46,175 of net earnings, so none.
      const twoEarners = calculate({
        federalIncome: 200000,
        spouseWages: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "marriedFilingJointly",
      }).selfEmploymentTaxBreakdown!;
      const oneEarner = calculate({
        federalIncome: 200000,
        selfEmploymentIncome: 50000,
        filingStatus: "marriedFilingJointly",
      }).selfEmploymentTaxBreakdown!;

      expect(twoEarners.socialSecurityTax).toBeCloseTo(5725.7, 2);
      expect(twoEarners.medicareTax).toBeCloseTo(46175 * 0.029, 2);
      expect(twoEarners.additionalMedicareTax).toBe(0);
      expect(oneEarner.socialSecurityTax).toBe(0);
    });
  });

  describe("self-employment tax", () => {
    it("charges 12.4% Social Security and 2.9% Medicare on 92.35% of $40,000 of business income", () => {
      // Net earnings: $40,000 x 92.35%   = $36,940
      // Social Security: $36,940 x 12.4% =  $4,580.56
      // Medicare: $36,940 x 2.9%         =  $1,071.26
      // Self-employment tax              =  $5,651.82
      // Deductible half                  =  $2,825.91
      const seTax = calculate({
        selfEmploymentIncome: 40000,
        filingStatus: "single",
      }).selfEmploymentTaxBreakdown!;

      expect(seTax.netEarnings).toBeCloseTo(36940, 2);
      expect(seTax.socialSecurityTax).toBeCloseTo(4580.56, 2);
      expect(seTax.medicareTax).toBeCloseTo(1071.26, 2);
      expect(seTax.totalSETax).toBeCloseTo(5651.82, 2);
      expect(seTax.deductibleHalf).toBeCloseTo(2825.91, 2);
    });

    it("stops the Social Security part at $184,500 of net earnings", () => {
      // Net earnings: $200,000 x 92.35%   = $184,700
      // Social Security: $184,500 x 12.4% =  $22,878.00
      // Medicare: $184,700 x 2.9%         =   $5,356.30
      // Self-employment tax               =  $28,234.30
      // Deductible half                   =  $14,117.15
      const seTax = calculate({
        selfEmploymentIncome: 200000,
        filingStatus: "single",
      }).selfEmploymentTaxBreakdown!;

      expect(seTax.socialSecurityTax).toBeCloseTo(22878, 2);
      expect(seTax.medicareTax).toBeCloseTo(5356.3, 2);
      expect(seTax.totalSETax).toBeCloseTo(28234.3, 2);
      expect(seTax.deductibleHalf).toBeCloseTo(14117.15, 2);
    });

    it("shares the Social Security wage base with wages, which use it first", () => {
      // $100,000 of wages leave $184,500 - $100,000 = $84,500 of the base
      // Net earnings: $100,000 x 92.35%  = $92,350
      // Social Security: $84,500 x 12.4% = $10,478.00
      // Medicare: $92,350 x 2.9%         =  $2,678.15
      // Self-employment tax              = $13,156.15
      const seTax = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      }).selfEmploymentTaxBreakdown!;

      expect(seTax.socialSecurityTax).toBeCloseTo(10478, 2);
      expect(seTax.medicareTax).toBeCloseTo(2678.15, 2);
      expect(seTax.totalSETax).toBeCloseTo(13156.15, 2);
    });

    it("charges only the Medicare part when wages of $184,500 use the whole wage base", () => {
      // Medicare: $92,350 x 2.9% = $2,678.15
      const seTax = calculate({
        federalIncome: 184500,
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      }).selfEmploymentTaxBreakdown!;

      expect(seTax.socialSecurityTax).toBe(0);
      expect(seTax.totalSETax).toBeCloseTo(2678.15, 2);
    });

    it("charges Social Security on the one dollar of wage base that $184,499 of wages leave", () => {
      // $1 x 12.4% = $0.124
      const seTax = calculate({
        federalIncome: 184499,
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      }).selfEmploymentTaxBreakdown!;

      expect(seTax.socialSecurityTax).toBeCloseTo(0.124, 3);
    });

    it("deducts half of the tax in reaching AGI, leaving gross income alone", () => {
      // Half of $5,651.82 = $2,825.91
      // AGI: $40,000 - $2,825.91 = $37,174.09
      const result = calculate({
        selfEmploymentIncome: 40000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(40000);
      expect(result.adjustedGrossIncome).toBeCloseTo(37174.09, 2);
    });

    it("is part of total tax, the amount owed and the safe harbor", () => {
      // $40,000 of business income, single
      // Taxable before the QBI deduction: $37,174.09 - $16,100 = $21,074.09
      // QBI deduction: 20% x $21,074.09 = $4,214.818
      // Taxable: $21,074.09 - $4,214.818 = $16,859.272
      //   $12,400 @ 10% ($1,240) + $4,459.272 @ 12% ($535.11) = $1,775.11
      // Total tax: $1,775.11 + $5,651.82 self-employment tax = $7,426.93
      // Owed after $5,000 of estimated payments: $2,426.93
      // Safe harbor: 90% x $7,426.93 = $6,684.24
      const result = calculate({
        selfEmploymentIncome: 40000,
        federalEstimatedPaid: 5000,
        filingStatus: "single",
      });

      expect(result.ordinaryIncomeTax).toBeCloseTo(1775.11, 2);
      expect(result.totalTax).toBeCloseTo(7426.93, 2);
      expect(result.remainingOwed).toBeCloseTo(2426.93, 2);
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(6684.24, 2);
    });

    it("is not calculated when there is no self-employment income", () => {
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.selfEmploymentTaxBreakdown).toBeUndefined();
      expect(result.adjustedGrossIncome).toBe(100000);
    });

    it("is left out, along with payroll tax, when no payroll tax data is passed", () => {
      // Business income is still ordinary income; with no tax there is no
      // deductible half, so AGI is the full $40,000
      const result = calculateWithoutPayrollData({
        selfEmploymentIncome: 40000,
        filingStatus: "single",
      });

      expect(result.selfEmploymentTaxBreakdown).toBeUndefined();
      expect(result.ficaBreakdown).toBeUndefined();
      expect(result.adjustedGrossIncome).toBe(40000);
    });
    describe("Additional Medicare tax on self-employment earnings", () => {
      // 0.9% of net earnings over $200,000 ($250,000 married filing
      // jointly, $125,000 married filing separately), after wages have used
      // up the threshold. Nobody withholds it, so it is part of the tax owed.

      it("is 0.9% of net earnings over $200,000 for a single filer", () => {
        // $300,000 x 92.35% = $277,050; $77,050 over; x 0.9% = $693.45
        const result = calculate({
          selfEmploymentIncome: 300000,
          filingStatus: "single",
        });

        expect(
          result.selfEmploymentTaxBreakdown!.additionalMedicareTax,
        ).toBeCloseTo(693.45, 2);
      });

      it("is nothing while net earnings are under the threshold", () => {
        // $200,000 x 92.35% = $184,700, under $200,000
        const result = calculate({
          selfEmploymentIncome: 200000,
          filingStatus: "single",
        });

        expect(result.selfEmploymentTaxBreakdown!.additionalMedicareTax).toBe(0);
      });

      it("counts wages against the threshold first", () => {
        // $150,000 of wages leave $50,000 of the threshold. Net earnings of
        // $92,350 are $42,350 over; x 0.9% = $381.15
        const result = calculate({
          federalIncome: 150000,
          selfEmploymentIncome: 100000,
          filingStatus: "single",
        });

        expect(
          result.selfEmploymentTaxBreakdown!.additionalMedicareTax,
        ).toBeCloseTo(381.15, 2);
      });

      it("starts exactly where wages plus net earnings pass the threshold", () => {
        // Net earnings are $92,350. Wages of $107,650 leave exactly that
        // much of the threshold; one more dollar of wages puts $1 over
        const at = calculate({
          federalIncome: 107650,
          selfEmploymentIncome: 100000,
          filingStatus: "single",
        });
        const over = calculate({
          federalIncome: 107651,
          selfEmploymentIncome: 100000,
          filingStatus: "single",
        });

        expect(
          at.selfEmploymentTaxBreakdown!.additionalMedicareTax,
        ).toBeCloseTo(0, 6);
        expect(
          over.selfEmploymentTaxBreakdown!.additionalMedicareTax,
        ).toBeCloseTo(0.009, 6);
      });

      it("applies to all net earnings once wages alone are over the threshold", () => {
        // $92,350 x 0.9% = $831.15
        const result = calculate({
          federalIncome: 250000,
          selfEmploymentIncome: 100000,
          filingStatus: "single",
        });

        expect(
          result.selfEmploymentTaxBreakdown!.additionalMedicareTax,
        ).toBeCloseTo(831.15, 2);
      });

      it.each([
        // $300,000 x 92.35% = $277,050 of net earnings in each case
        ["marriedFilingJointly", 243.45], // $27,050 over $250,000
        ["marriedFilingSeparately", 1368.45], // $152,050 over $125,000
      ] as const)("uses the threshold for %s", (filingStatus, expected) => {
        const result = calculate({
          selfEmploymentIncome: 300000,
          filingStatus,
        });

        expect(
          result.selfEmploymentTaxBreakdown!.additionalMedicareTax,
        ).toBeCloseTo(expected, 2);
      });

      it("is added to total tax, but not to self-employment tax or its deductible half", () => {
        // Net earnings $277,050. Social Security: $184,500 x 12.4% = $22,878.
        // Medicare: $277,050 x 2.9% = $8,034.45. Self-employment tax
        // $30,912.45, half of it $15,456.225. Additional Medicare $693.45.
        const result = calculate({
          selfEmploymentIncome: 300000,
          filingStatus: "single",
        });
        const seTax = result.selfEmploymentTaxBreakdown!;

        expect(seTax.totalSETax).toBeCloseTo(30912.45, 2);
        expect(seTax.deductibleHalf).toBeCloseTo(15456.225, 2);
        expect(result.adjustedGrossIncome).toBeCloseTo(284543.775, 2);
        // Everything in total tax other than income tax: $30,912.45 + $693.45
        expect(result.totalTax - result.ordinaryIncomeTax).toBeCloseTo(
          31605.9,
          2,
        );
      });
    });
  });

  describe("QBI deduction", () => {
    it("deducts 20% of business income, after the deductible half of self-employment tax, from taxable income but not from AGI", () => {
      // $100,000 wages + $40,000 business income, single
      // Self-employment tax: $36,940 net earnings x 15.3% = $5,651.82;
      //   deductible half $2,825.91
      // AGI: $140,000 - $2,825.91 = $137,174.09
      // Taxable before the deduction: $137,174.09 - $16,100 = $121,074.09
      // Qualified business income: $40,000 - $2,825.91 = $37,174.09
      // QBI deduction: 20% x $37,174.09 = $7,434.818 (under 20% of taxable
      //   income, $24,214.82)
      // Taxable ordinary income: $121,074.09 - $7,434.818 = $113,639.272
      const result = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 40000,
        filingStatus: "single",
      });

      expect(result.qbiDeduction!.qualifiedBusinessIncome).toBeCloseTo(
        37174.09,
        2,
      );
      expect(result.qbiDeduction!.tentativeDeduction).toBeCloseTo(7434.818, 2);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(7434.818, 2);
      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);
      expect(result.adjustedGrossIncome).toBeCloseTo(137174.09, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(113639.272, 2);
    });

    it("limits the deduction to 20% of taxable income when that is less", () => {
      // $40,000 business income only, single
      // Taxable before the deduction: $40,000 - $2,825.91 - $16,100
      //   = $21,074.09
      // 20% x $21,074.09 = $4,214.818, less than 20% of the $37,174.09 of
      //   qualified business income = $7,434.818
      const result = calculate({
        selfEmploymentIncome: 40000,
        filingStatus: "single",
      });

      expect(result.qbiDeduction!.tentativeDeduction).toBeCloseTo(7434.818, 2);
      expect(result.qbiDeduction!.taxableIncomeLimit).toBeCloseTo(4214.818, 2);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(4214.818, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(16859.272, 2);
    });

    it("leaves income taxed at long-term rates out of the 20% of taxable income limit", () => {
      // As above, plus $50,000 of qualified dividends. Taxable income is
      // now $71,074.09, but the limit is still 20% of the $21,074.09 of
      // ordinary taxable income = $4,214.818
      const result = calculate({
        selfEmploymentIncome: 40000,
        ordinaryDividends: 50000,
        qualifiedDividends: 50000,
        filingStatus: "single",
      });

      expect(result.taxableLTCG).toBe(50000);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(4214.818, 2);
    });

    it("is not given when there is no business income", () => {
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.qbiDeduction).toBeUndefined();
    });

    it("is not given when the standard deduction leaves no ordinary taxable income", () => {
      // $16,100 business income - $16,100 = $0
      const result = calculateWithoutPayrollData({
        selfEmploymentIncome: 16100,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.qbiDeduction).toBeUndefined();
    });

    it("is 20% of the first dollar of ordinary taxable income", () => {
      // $16,101 business income - $16,100 = $1; 20% x $1 = $0.20
      const result = calculateWithoutPayrollData({
        selfEmploymentIncome: 16101,
        filingStatus: "single",
      });

      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(0.2, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(0.8, 2);
    });

    // The phase-out is tested against taxable income before the deduction.
    // Each return below has $50,000 of business income (a $10,000 deduction
    // before the phase-out) and wages chosen to put taxable income where the
    // test needs it: taxable income = wages + $50,000 - standard deduction.
    describe.each([
      {
        // Standard deduction $16,100: wages = taxable income - $33,900
        filingStatus: "single",
        label: "a single filer: $201,750 to $276,750",
        wagesAtStart: 167850, // taxable income $201,750
        wagesAtMiddle: 205350, // taxable income $239,250
        wagesAtEnd: 242850, // taxable income $276,750
        // $10,000 x (1 - $1 / $75,000) = $9,999.87
        oneDollarIn: 9999.87,
        // $10,000 x $1 / $75,000 = $0.13
        oneDollarFromEnd: 0.13,
      },
      {
        // Standard deduction $32,200: wages = taxable income - $17,800
        filingStatus: "marriedFilingJointly",
        label: "married filing jointly: $403,500 to $553,500",
        wagesAtStart: 385700, // taxable income $403,500
        wagesAtMiddle: 460700, // taxable income $478,500
        wagesAtEnd: 535700, // taxable income $553,500
        // $10,000 x (1 - $1 / $150,000) = $9,999.93
        oneDollarIn: 9999.93,
        // $10,000 x $1 / $150,000 = $0.07
        oneDollarFromEnd: 0.07,
      },
      {
        // Standard deduction $16,100: wages = taxable income - $33,900
        filingStatus: "marriedFilingSeparately",
        label: "married filing separately: $201,775 to $276,775",
        wagesAtStart: 167875, // taxable income $201,775
        wagesAtMiddle: 205375, // taxable income $239,275
        wagesAtEnd: 242875, // taxable income $276,775
        // $10,000 x (1 - $1 / $75,000) = $9,999.87
        oneDollarIn: 9999.87,
        // $10,000 x $1 / $75,000 = $0.13
        oneDollarFromEnd: 0.13,
      },
    ] as const)(
      "phase-out for $label",
      ({
        filingStatus,
        wagesAtStart,
        wagesAtMiddle,
        wagesAtEnd,
        oneDollarIn,
        oneDollarFromEnd,
      }) => {
        const qbiFor = (federalIncome: number) =>
          calculateWithoutPayrollData({
            federalIncome,
            selfEmploymentIncome: 50000,
            filingStatus,
          }).qbiDeduction!;

        it("gives the full $10,000 at the start of the range", () => {
          const qbi = qbiFor(wagesAtStart);

          expect(qbi.phaseoutApplied).toBe(false);
          expect(qbi.finalDeduction).toBe(10000);
        });

        it("starts reducing the deduction one dollar into the range", () => {
          const qbi = qbiFor(wagesAtStart + 1);

          expect(qbi.phaseoutApplied).toBe(true);
          expect(qbi.finalDeduction).toBeCloseTo(oneDollarIn, 2);
        });

        it("gives half, $5,000, in the middle of the range", () => {
          const qbi = qbiFor(wagesAtMiddle);

          expect(qbi.phaseoutApplied).toBe(true);
          expect(qbi.finalDeduction).toBeCloseTo(5000, 2);
        });

        it("still gives a few cents one dollar before the end of the range", () => {
          expect(qbiFor(wagesAtEnd - 1).finalDeduction).toBeCloseTo(
            oneDollarFromEnd,
            2,
          );
        });

        it("gives nothing at the end of the range", () => {
          const qbi = qbiFor(wagesAtEnd);

          expect(qbi.phaseoutApplied).toBe(true);
          expect(qbi.finalDeduction).toBe(0);
        });

        it("gives nothing, never a negative amount, beyond the range", () => {
          expect(qbiFor(wagesAtEnd + 50000).finalDeduction).toBe(0);
        });
      },
    );

    it("counts income taxed at long-term rates toward the phase-out", () => {
      // Single: $100,000 wages + $50,000 business income - $16,100
      //   = $133,900 of ordinary taxable income, under the $201,750 start
      // Adding a $105,350 long-term gain makes taxable income $239,250, the
      // middle of the range, so half of the $10,000 is left
      const result = calculateWithoutPayrollData({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        longTermCapitalGains: 105350,
        filingStatus: "single",
      });

      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(5000, 2);
    });

    it("tests the phase-out against income after the deductible half of self-employment tax", () => {
      // $300,000 of business income, single
      // Net earnings: $300,000 x 92.35%   = $277,050
      // Social Security: $184,500 x 12.4% =  $22,878.00
      // Medicare: $277,050 x 2.9%         =   $8,034.45
      // Self-employment tax               =  $30,912.45
      // Deductible half                   =  $15,456.225
      //
      // Taxable before the deduction: $300,000 - $15,456.225 - $16,100
      //   = $268,443.775
      // Before the phase-out: the lesser of 20% x $300,000 = $60,000 and
      //   20% x $268,443.775 = $53,688.755
      // Share phased out: ($268,443.775 - $201,750) / $75,000 = 0.88925
      // Deduction: $53,688.755 x (1 - 0.88925) = $5,946.01
      const result = calculate({
        selfEmploymentIncome: 300000,
        filingStatus: "single",
      });

      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(5946.01, 2);
    });
  });

  describe("net investment income tax", () => {
    it("charges 3.8% on net investment income when that is less than AGI over the threshold", () => {
      // Single: $250,000 wages + $100,000 long-term gain = $350,000 AGI,
      // $150,000 over $200,000. Net investment income is $100,000.
      // 3.8% x $100,000 = $3,800
      const niit = calculate({
        federalIncome: 250000,
        longTermCapitalGains: 100000,
        filingStatus: "single",
      }).niitBreakdown!;

      expect(niit.netInvestmentIncome).toBe(100000);
      expect(niit.magiOverThreshold).toBe(150000);
      expect(niit.taxableAmount).toBe(100000);
      expect(niit.tax).toBeCloseTo(3800, 2);
    });

    it("charges 3.8% on AGI over the threshold when that is less than net investment income", () => {
      // Single: $180,000 wages + $50,000 long-term gain = $230,000 AGI,
      // $30,000 over $200,000. Net investment income is $50,000.
      // 3.8% x $30,000 = $1,140
      const niit = calculate({
        federalIncome: 180000,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      }).niitBreakdown!;

      expect(niit.netInvestmentIncome).toBe(50000);
      expect(niit.magiOverThreshold).toBe(30000);
      expect(niit.taxableAmount).toBe(30000);
      expect(niit.tax).toBeCloseTo(1140, 2);
    });

    // Each return has $50,000 of interest, so AGI over the threshold is the
    // smaller figure: AGI = wages + $50,000
    it.each([
      { filingStatus: "single", threshold: 200000, wages: 150000 },
      {
        filingStatus: "marriedFilingJointly",
        threshold: 250000,
        wages: 200000,
      },
      {
        filingStatus: "marriedFilingSeparately",
        threshold: 125000,
        wages: 75000,
      },
    ] as const)(
      "starts one dollar over $threshold of AGI for $filingStatus",
      ({ filingStatus, wages }) => {
        const atThreshold = calculate({
          federalIncome: wages,
          interestIncome: 50000,
          filingStatus,
        });
        const oneDollarOver = calculate({
          federalIncome: wages + 1,
          interestIncome: 50000,
          filingStatus,
        });

        expect(atThreshold.niitBreakdown).toBeUndefined();
        expect(oneDollarOver.niitBreakdown!.taxableAmount).toBe(1);
        // $1 x 3.8% = $0.038
        expect(oneDollarOver.niitBreakdown!.tax).toBeCloseTo(0.038, 3);
      },
    );

    it("measures the threshold against AGI, after 401(k) contributions", () => {
      // Single: $200,000 wages + $50,000 interest - $20,000 401(k)
      //   = $230,000 AGI, $30,000 over $200,000
      // 3.8% x $30,000 = $1,140 (gross income would give $50,000 over)
      const niit = calculate({
        federalIncome: 200000,
        interestIncome: 50000,
        contributions401k: 20000,
        filingStatus: "single",
      }).niitBreakdown!;

      expect(niit.magiOverThreshold).toBe(30000);
      expect(niit.tax).toBeCloseTo(1140, 2);
    });

    it("counts interest, all dividends, short-term and long-term gains as investment income", () => {
      // $10,000 interest + $20,000 dividends (qualified or not) + $30,000
      // short-term gain + $40,000 long-term gain = $100,000
      // AGI $400,000 is $200,000 over; 3.8% x $100,000 = $3,800
      const niit = calculate({
        federalIncome: 300000,
        interestIncome: 10000,
        ordinaryDividends: 20000,
        qualifiedDividends: 5000,
        shortTermCapitalGains: 30000,
        longTermCapitalGains: 40000,
        filingStatus: "single",
      }).niitBreakdown!;

      expect(niit.netInvestmentIncome).toBe(100000);
      expect(niit.tax).toBeCloseTo(3800, 2);
    });

    it("does not count wages or self-employment income as investment income", () => {
      // AGI is far over $200,000 but there is no investment income
      const result = calculate({
        federalIncome: 300000,
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      expect(result.niitBreakdown).toBeUndefined();
    });

    it("counts gains net of the loss carryover used against them", () => {
      // Single: $300,000 wages, $100,000 long-term gain, $30,000 carryover
      // Net investment income: $100,000 - $30,000 = $70,000
      // AGI $370,000 is $170,000 over; 3.8% x $70,000 = $2,660
      const niit = calculate({
        federalIncome: 300000,
        longTermCapitalGains: 100000,
        priorYearLongTermLossCarryover: 30000,
        filingStatus: "single",
      }).niitBreakdown!;

      expect(niit.netInvestmentIncome).toBe(70000);
      expect(niit.magiOverThreshold).toBe(170000);
      expect(niit.tax).toBeCloseTo(2660, 2);
    });

    it("reduces investment income by the $3,000 of capital loss deducted from other income", () => {
      // Single: $250,000 wages, $50,000 interest, $10,000 loss carryover
      // Net investment income: $50,000 - $3,000 = $47,000
      // AGI $297,000 is $97,000 over; 3.8% x $47,000 = $1,786
      const niit = calculate({
        federalIncome: 250000,
        interestIncome: 50000,
        priorYearLongTermLossCarryover: 10000,
        filingStatus: "single",
      }).niitBreakdown!;

      expect(niit.netInvestmentIncome).toBe(47000);
      expect(niit.magiOverThreshold).toBe(97000);
      expect(niit.tax).toBeCloseTo(1786, 2);
    });
  });

  describe("income tested by the 2026 limit on itemized deductions", () => {
    it("counts long-term gains toward the $640,600 top bracket test", () => {
      // Single: $400,000 wages + $260,000 long-term gain = $660,000 AGI,
      // although only $400,000 is ordinary income
      // Itemized: $10,000 state tax (capped) + $20,000 mortgage interest
      //   + $23,300 gifts less the $3,300 floor = $50,000
      // Reduction: 2/37 x the lesser of $50,000 and
      //   $660,000 - $640,600 = $19,400, = $1,048.65
      // Deduction: $50,000 - $1,048.65 = $48,951.35
      const result = calculate({
        federalIncome: 400000,
        longTermCapitalGains: 260000,
        stateTaxWithheld: 40000,
        mortgageInterestPaid: 20000,
        charitableContributions: 23300,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.highIncomeReduction).toBeCloseTo(
        1048.65,
        2,
      );
      expect(result.deductionBreakdown.deductionAmount).toBeCloseTo(
        48951.35,
        2,
      );
    });

    it("tests AGI less the QBI deduction", () => {
      // Married filing separately, $350,000 wages + $50,000 business income
      // (no payroll tax data, so AGI is a round $400,000)
      // Itemized: $202,000 gifts less the $2,000 floor = $200,000
      // Taxable before the QBI deduction: $400,000 - $200,000 = $200,000,
      //   under the $201,775 phase-out, so the QBI deduction is
      //   20% x $50,000 = $10,000
      // Income tested: $400,000 - $10,000 = $390,000, which is
      //   $390,000 - $384,350 = $5,650 into the top bracket
      // Reduction: 2/37 x $5,650 = $305.41
      // Deduction: $200,000 - $305.41 = $199,694.59
      const result = calculateWithoutPayrollData({
        federalIncome: 350000,
        selfEmploymentIncome: 50000,
        charitableContributions: 202000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.adjustedGrossIncome).toBe(400000);
      expect(result.qbiDeduction!.finalDeduction).toBe(10000);
      expect(result.deductionBreakdown.highIncomeReduction).toBeCloseTo(
        305.41,
        2,
      );
      expect(result.deductionBreakdown.deductionAmount).toBeCloseTo(
        199694.59,
        2,
      );
    });

    it("keeps the QBI deduction worked out before the limit when the return still itemizes", () => {
      // As above with $162,725 of gifts: itemized $160,725 after the floor
      // Taxable before the QBI deduction: $400,000 - $160,725 = $239,275,
      //   the middle of the $201,775 to $276,775 phase-out, so the QBI
      //   deduction is half of $10,000 = $5,000
      // Income tested: $400,000 - $5,000 = $395,000, $10,650 into the top
      //   bracket. Reduction: 2/37 x $10,650 = $575.68
      // Deduction: $160,725 - $575.68 = $160,149.32
      // The smaller deduction raises taxable income to $239,850.68, but the
      // QBI deduction is not worked out again (it would fall to $4,923.24)
      // Taxable: $400,000 - $160,149.32 - $5,000 = $234,850.68
      const result = calculateWithoutPayrollData({
        federalIncome: 350000,
        selfEmploymentIncome: 50000,
        charitableContributions: 162725,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.highIncomeReduction).toBeCloseTo(
        575.68,
        2,
      );
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(5000, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(234850.68, 2);
    });

    it("works the QBI deduction out again when the limit moves the return to the standard deduction", () => {
      // Single, $650,000 wages + $50,000 business income (no payroll tax
      // data): AGI $700,000
      // Itemized: $10,000 state tax + $6,200 mortgage interest = $16,200,
      //   $100 more than the $16,100 standard deduction
      // Reduction: 2/37 x $16,200 = $875.68, leaving $15,324.32, so the
      //   standard deduction is now better
      // Taxable before the QBI deduction: $700,000 - $16,100 = $683,900
      // QBI: fully phased out either way, but its 20% of taxable income
      //   figure is restated: 20% x $683,900 = $136,780 (it was
      //   20% x $683,800 = $136,760 while itemizing)
      const result = calculateWithoutPayrollData({
        federalIncome: 650000,
        selfEmploymentIncome: 50000,
        stateTaxWithheld: 10000,
        mortgageInterestPaid: 6200,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("standard");
      expect(result.deductionBreakdown.deductionAmount).toBe(16100);
      expect(result.qbiDeduction!.taxableIncomeLimit).toBeCloseTo(136780, 2);
      expect(result.qbiDeduction!.finalDeduction).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(683900);
    });
  });

  describe("deduction choice", () => {
    it("picks the larger of the standard and itemized deduction when no choice is passed", () => {
      // Single, $100,000 wages, $20,000 mortgage interest: $20,000 beats
      // $16,100. Taxable: $100,000 - $20,000 = $80,000
      const result = calculate({
        federalIncome: 100000,
        mortgageInterestPaid: 20000,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.taxableOrdinaryIncome).toBe(80000);
    });

    it("uses the $16,100 standard deduction when told to, even though itemizing gives $20,000", () => {
      // Taxable: $100,000 - $16,100 = $83,900
      const result = calculate(
        {
          federalIncome: 100000,
          mortgageInterestPaid: 20000,
          filingStatus: "single",
        },
        "standard",
      );

      expect(result.deductionBreakdown.deductionUsed).toBe("standard");
      expect(result.deductionBreakdown.deductionAmount).toBe(16100);
      expect(result.taxableOrdinaryIncome).toBe(83900);
    });

    it("itemizes $10,000 when told to, even though the standard deduction is $16,100", () => {
      // Taxable: $100,000 - $10,000 = $90,000
      const result = calculate(
        {
          federalIncome: 100000,
          mortgageInterestPaid: 10000,
          filingStatus: "single",
        },
        "itemized",
      );

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.deductionAmount).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(90000);
    });

    it("keeps itemizing when told to, even after the 2026 limit takes it below the standard deduction", () => {
      // Single, $700,000 wages. Itemized: $10,000 state tax + $6,200
      // mortgage interest = $16,200
      // Reduction: 2/37 x $16,200 = $875.68, leaving $15,324.32
      // Taxable: $700,000 - $15,324.32 = $684,675.68
      const result = calculate(
        {
          federalIncome: 700000,
          stateTaxWithheld: 10000,
          mortgageInterestPaid: 6200,
          filingStatus: "single",
        },
        "itemized",
      );

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.deductionAmount).toBeCloseTo(
        15324.32,
        2,
      );
      expect(result.taxableOrdinaryIncome).toBeCloseTo(684675.68, 2);
    });
  });

  describe("total tax", () => {
    it("adds ordinary income tax, tax at long-term rates, self-employment tax and NIIT, and leaves out payroll tax", () => {
      // Married filing jointly: $190,000 wages, $20,000 business income
      // and a $100,000 long-term gain
      //
      // Self-employment tax: wages use the whole Social Security base, so
      //   only Medicare applies: $20,000 x 92.35% x 2.9% = $535.63
      //   Deductible half: $267.815
      // AGI: $310,000 - $267.815 = $309,732.185
      //
      // Taxable ordinary income before the QBI deduction:
      //   $210,000 - $267.815 - $32,200 = $177,532.185
      // QBI deduction: 20% x ($20,000 - $267.815) = $3,946.437
      // Taxable ordinary income: $173,585.748
      //   $24,800 @ 10%                             =  $2,480.00
      //   $76,000 @ 12%                             =  $9,120.00
      //   $72,785.748 ($173,585.748 - $100,800) @ 22% = $16,012.86
      //   Ordinary income tax                       = $27,612.86
      //
      // Long-term gain: $100,000 stacked from $173,586 to $273,586, all at
      //   15% = $15,000
      //
      // Additional Medicare on business income: wages leave $60,000 of the
      //   $250,000 threshold, more than the $18,470 of net earnings, so none
      //
      // NIIT: AGI is $59,732.185 over $250,000, less than the $100,000 of
      //   investment income. 3.8% x $59,732.185 = $2,269.82
      //
      // Total tax: $27,612.86 + $15,000 + $535.63 + $2,269.82 = $45,418.32
      //
      // Payroll tax, left out: $184,500 x 6.2% ($11,439)
      //   + $190,000 x 1.45% ($2,755) = $14,194
      const result = calculate({
        federalIncome: 190000,
        selfEmploymentIncome: 20000,
        longTermCapitalGains: 100000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.ordinaryIncomeTax).toBeCloseTo(27612.86, 2);
      expect(result.ltcgTax).toBeCloseTo(15000, 2);
      expect(result.selfEmploymentTaxBreakdown!.totalSETax).toBeCloseTo(
        535.63,
        2,
      );
      expect(result.niitBreakdown!.tax).toBeCloseTo(2269.82, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(14194, 2);
      expect(result.selfEmploymentTaxBreakdown!.additionalMedicareTax).toBe(0);
      expect(result.totalTax).toBeCloseTo(45418.32, 2);
    });
  });

  describe("payments, refund and amount owed", () => {
    // Single, $100,000 of wages: total tax is $13,170 (see "ordinary income
    // schedule")
    it("owes the tax left after federal withholding and estimated payments", () => {
      // Paid: $10,000 + $2,000 = $12,000. Owed: $13,170 - $12,000 = $1,170
      const result = calculate({
        federalIncome: 100000,
        federalTaxWithheld: 10000,
        federalEstimatedPaid: 2000,
        filingStatus: "single",
      });

      expect(result.withheld).toBe(10000);
      expect(result.estimatedPaid).toBe(2000);
      expect(result.totalPaid).toBe(12000);
      expect(result.remainingOwed).toBe(1170);
      expect(result.refundDue).toBe(0);
    });

    it("refunds what was paid beyond the tax", () => {
      // Paid: $12,000 + $2,000 = $14,000. Refund: $14,000 - $13,170 = $830
      const result = calculate({
        federalIncome: 100000,
        federalTaxWithheld: 12000,
        federalEstimatedPaid: 2000,
        filingStatus: "single",
      });

      expect(result.totalPaid).toBe(14000);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(830);
    });

    it("owes nothing and refunds nothing when payments equal the tax", () => {
      const result = calculate({
        federalIncome: 100000,
        federalTaxWithheld: 13170,
        filingStatus: "single",
      });

      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
    });

    it("does not count state withholding or state estimated payments", () => {
      const result = calculate({
        federalIncome: 100000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 1000,
        filingStatus: "single",
      });

      expect(result.totalPaid).toBe(0);
      expect(result.remainingOwed).toBe(13170);
    });
  });

  describe("safe harbor", () => {
    // Single, $100,000 of wages: total tax is $13,170, and 90% of it is
    // $11,853
    it("requires 90% of this year's tax when last year's tax is not entered", () => {
      const safeHarbor = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      }).safeHarbor!;

      expect(safeHarbor.currentYear90Percent).toBeCloseTo(11853, 2);
      expect(safeHarbor.minimum).toBeCloseTo(11853, 2);
    });

    it("requires 110% of last year's tax when last year's income was over $150,000", () => {
      // 110% x $10,000 = $11,000, less than $11,853
      const safeHarbor = calculate({
        federalIncome: 100000,
        priorYearFederalTax: 10000,
        priorYearIncomeOverThreshold: true,
        filingStatus: "single",
      }).safeHarbor!;

      expect(safeHarbor.priorYearPercent).toBe(1.1);
      expect(safeHarbor.priorYearSafeHarbor).toBeCloseTo(11000, 2);
      expect(safeHarbor.minimum).toBeCloseTo(11000, 2);
    });

    it("assumes last year's income was over $150,000 when not told", () => {
      const safeHarbor = calculate({
        federalIncome: 100000,
        priorYearFederalTax: 10000,
        filingStatus: "single",
      }).safeHarbor!;

      expect(safeHarbor.priorYearPercent).toBe(1.1);
      expect(safeHarbor.minimum).toBeCloseTo(11000, 2);
    });

    it("requires 100% of last year's tax when last year's income was not over $150,000", () => {
      // 100% x $10,000 = $10,000
      const safeHarbor = calculate({
        federalIncome: 100000,
        priorYearFederalTax: 10000,
        priorYearIncomeOverThreshold: false,
        filingStatus: "single",
      }).safeHarbor!;

      expect(safeHarbor.priorYearPercent).toBe(1);
      expect(safeHarbor.priorYearSafeHarbor).toBe(10000);
      expect(safeHarbor.minimum).toBe(10000);
    });

    it("requires 90% of this year's tax when that is less than the share of last year's", () => {
      // 110% x $20,000 = $22,000, more than $11,853
      const safeHarbor = calculate({
        federalIncome: 100000,
        priorYearFederalTax: 20000,
        filingStatus: "single",
      }).safeHarbor!;

      expect(safeHarbor.priorYearSafeHarbor).toBeCloseTo(22000, 2);
      expect(safeHarbor.minimum).toBeCloseTo(11853, 2);
    });

    it("is measured against federal withholding plus estimated payments", () => {
      // Required: $10,000 (100% of last year's tax)
      const inputs = {
        federalIncome: 100000,
        priorYearFederalTax: 10000,
        priorYearIncomeOverThreshold: false,
        federalTaxWithheld: 8000,
        filingStatus: "single",
      } as const;

      const met = calculate({ ...inputs, federalEstimatedPaid: 2000 });
      const short = calculate({ ...inputs, federalEstimatedPaid: 1999 });

      expect(met.safeHarbor!.met).toBe(true);
      expect(met.safeHarbor!.remaining).toBe(0);
      expect(short.safeHarbor!.met).toBe(false);
      expect(short.safeHarbor!.remaining).toBe(1);
    });
  });

  describe("shared building blocks", () => {
    it("nets gains, losses and carryovers before taxing them", () => {
      // Short-term: $15,000 gain - $20,000 carryover = $5,000 net loss
      // Long-term: $25,000 gain - $10,000 carryover = $15,000 net gain
      // The short-term loss takes the long-term gain down to $10,000
      // Nothing is left to deduct, so ordinary income is wages only:
      //   $80,000 - $16,100 = $63,900
      const result = calculate({
        federalIncome: 80000,
        shortTermCapitalGains: 15000,
        longTermCapitalGains: 25000,
        priorYearShortTermLossCarryover: 20000,
        priorYearLongTermLossCarryover: 10000,
        filingStatus: "single",
      });

      expect(result.shortTermLossCarryoverOffset).toBe(20000);
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.taxableLTCG).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(63900);
    });

    it("stacks income taxed at long-term rates on top of taxable ordinary income", () => {
      // Single: $55,750 wages - $16,100 = $39,650 of taxable ordinary income
      // The 0% band ends at $49,450, leaving room for $9,800 of the $20,000
      // gain; the other $10,200 is taxed at 15% = $1,530
      const result = calculate({
        federalIncome: 55750,
        longTermCapitalGains: 20000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(39650);
      expect(result.ltcgBracketBreakdown).toHaveLength(2);
      expect(result.ltcgBracketBreakdown[0].incomeInBracket).toBe(9800);
      expect(result.ltcgBracketBreakdown[1].incomeInBracket).toBe(10200);
      expect(result.ltcgTax).toBeCloseTo(1530, 2);
    });

    it("stacks on taxable ordinary income after the QBI deduction", () => {
      // Single, no payroll tax data: $55,750 business income - $16,100
      //   = $39,650, less a QBI deduction of 20% x $39,650 = $7,930
      //   = $31,720 of taxable ordinary income
      // Room in the 0% band: $49,450 - $31,720 = $17,730
      // The other $2,270 of the $20,000 gain is taxed at 15% = $340.50
      const result = calculateWithoutPayrollData({
        selfEmploymentIncome: 55750,
        longTermCapitalGains: 20000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(31720);
      expect(result.ltcgTax).toBeCloseTo(340.5, 2);
    });

    it("gives the deduction calculator AGI, not gross income", () => {
      // Single: $220,000 wages - $20,000 401(k) = $200,000 AGI
      // Charitable floor: 0.5% x $200,000 = $1,000 (gross income would
      //   give $1,100)
      // Itemized: $31,000 gifts - $1,000 = $30,000
      // Taxable: $200,000 - $30,000 = $170,000
      const result = calculate({
        federalIncome: 220000,
        contributions401k: 20000,
        charitableContributions: 31000,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.charitableFloorReduction).toBe(1000);
      expect(result.deductionBreakdown.deductionAmount).toBe(30000);
      expect(result.taxableOrdinaryIncome).toBe(170000);
    });
  });

  describe("zero and empty inputs", () => {
    it("returns zero tax and no optional breakdowns when every input is zero", () => {
      const result = calculate();

      expect(result.grossIncome).toBe(0);
      expect(result.adjustedGrossIncome).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.ltcgTax).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
      expect(result.ficaBreakdown!.totalFica).toBe(0);
      expect(result.niitBreakdown).toBeUndefined();
      expect(result.qbiDeduction).toBeUndefined();
      expect(result.selfEmploymentTaxBreakdown).toBeUndefined();
      expect(result.safeHarbor!.minimum).toBe(0);
      expect(result.safeHarbor!.met).toBe(true);
    });

    it("refunds payments made when there is no income", () => {
      const result = calculate({
        federalTaxWithheld: 1000,
        federalEstimatedPaid: 500,
      });

      expect(result.totalTax).toBe(0);
      expect(result.refundDue).toBe(1500);
    });

    it("reports a carryover as unused when there is no income to set it against", () => {
      const result = calculate({ priorYearShortTermLossCarryover: 10000 });

      expect(result.shortTermLossCarryoverOffset).toBe(0);
      expect(result.shortTermLossCarryoverUnused).toBe(10000);
      expect(result.adjustedGrossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateFederalTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    const calculateForYear = (overrides: Partial<TaxInputs>) =>
      calculateFederalTax(
        createDefaultInputs({ taxYear: year, ...overrides }),
        data.federalBrackets,
        data.ltcgBrackets,
        data.federalDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.ficaData,
      );

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("uses the year's standard deduction and brackets for $100,000 of wages", () => {
      // 2025: $100,000 - $15,750 = $84,250
      //   $11,925 @ 10% ($1,192.50) + $36,550 @ 12% ($4,386)
      //   + $35,775 @ 22% ($7,870.50) = $13,449
      // 2026: $100,000 - $16,100 = $83,900
      //   $12,400 @ 10% ($1,240) + $38,000 @ 12% ($4,560)
      //   + $33,500 @ 22% ($7,370) = $13,170
      const expected = {
        "2025": { taxableIncome: 84250, tax: 13449 },
        "2026": { taxableIncome: 83900, tax: 13170 },
      };

      const result = calculateForYear({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(expected[year].taxableIncome);
      expect(result.ordinaryIncomeTax).toBeCloseTo(expected[year].tax, 2);
    });

    it.each([
      "single",
      "marriedFilingJointly",
      "marriedFilingSeparately",
    ] as const)(
      "uses the year's standard deduction for %s",
      (filingStatus) => {
        const result = calculateForYear({
          federalIncome: 100000,
          filingStatus,
        });

        expect(result.deductionBreakdown.deductionAmount).toBe(
          data.federalDeductions.standardDeduction[filingStatus],
        );
      },
    );

    it("uses the year's long-term schedule", () => {
      // A long-term gain that, after the standard deduction, ends $1,000
      // past the 0% band: $1,000 @ 15% = $150
      const zeroRateEnd = data.ltcgBrackets.brackets.single[0].max!;
      const result = calculateForYear({
        longTermCapitalGains:
          zeroRateEnd + data.federalDeductions.standardDeduction.single + 1000,
        filingStatus: "single",
      });

      expect(result.ltcgTax).toBeCloseTo(150, 2);
    });

    it("stops Social Security at the year's wage base", () => {
      // 2025: $176,100 x 6.2% = $10,918.20
      // 2026: $184,500 x 6.2% = $11,439.00
      const expected = {
        "2025": { wageBase: 176100, tax: 10918.2 },
        "2026": { wageBase: 184500, tax: 11439 },
      };

      const fica = calculateForYear({
        federalIncome: 250000,
        filingStatus: "single",
      }).ficaBreakdown!;

      expect(data.ficaData.socialSecurity.wageBaseCap).toBe(
        expected[year].wageBase,
      );
      expect(fica.socialSecurityWages).toBe(expected[year].wageBase);
      expect(fica.socialSecurityTax).toBeCloseTo(expected[year].tax, 2);
    });

    it("starts the QBI phase-out at the year's threshold", () => {
      // Wages equal to the single threshold plus the standard deduction
      // put taxable income on the threshold by themselves, so $10,000 of
      // business income on top is inside the phase-out. With $50,000 less
      // in wages the same return is below it and gets the full 20% of its
      // qualified business income.
      const threshold = data.federalLimits.qbiDeduction.taxableIncomeThreshold;
      const wages =
        threshold.single + data.federalDeductions.standardDeduction.single;
      const below = calculateForYear({
        federalIncome: wages - 50000,
        selfEmploymentIncome: 10000,
        filingStatus: "single",
      });
      const above = calculateForYear({
        federalIncome: wages,
        selfEmploymentIncome: 10000,
        filingStatus: "single",
      });

      expect(below.qbiDeduction!.phaseoutApplied).toBe(false);
      expect(below.qbiDeduction!.finalDeduction).toBe(
        below.qbiDeduction!.tentativeDeduction,
      );
      expect(above.qbiDeduction!.phaseoutApplied).toBe(true);
      expect(above.qbiDeduction!.finalDeduction).toBeLessThan(
        above.qbiDeduction!.tentativeDeduction,
      );
    });

    it("applies the limit on itemized deductions only from 2026", () => {
      // Single, $700,000 wages. Itemized: $10,000 state tax (the cap at
      // this income in both years) + $40,000 mortgage interest = $50,000
      // 2025: no limit
      // 2026: income is $59,400 into the top bracket, more than $50,000,
      //   so the reduction is 2/37 x $50,000 = $2,702.70
      const expected = {
        "2025": { reduction: 0, deduction: 50000 },
        "2026": { reduction: 2702.7, deduction: 47297.3 },
      };

      const { deductionBreakdown } = calculateForYear({
        federalIncome: 700000,
        stateTaxWithheld: 10000,
        mortgageInterestPaid: 40000,
        filingStatus: "single",
      });

      expect(deductionBreakdown.highIncomeReduction ?? 0).toBeCloseTo(
        expected[year].reduction,
        2,
      );
      expect(deductionBreakdown.deductionAmount).toBeCloseTo(
        expected[year].deduction,
        2,
      );
    });
  },
);
