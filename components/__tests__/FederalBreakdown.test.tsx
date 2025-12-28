import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FederalBreakdown from '../FederalBreakdown';
import { TaxCalculationResult } from '@/lib/types';

const createMockResult = (overrides: Partial<TaxCalculationResult> = {}): TaxCalculationResult => ({
  wageIncome: 100000,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  grossIncome: 100000,
  shortTermLossCarryoverOffset: 0,
  longTermLossCarryoverOffset: 0,
  contributions401k: 0,
  adjustedGrossIncome: 84300,
  deductionBreakdown: {
    standardDeduction: 15700,
    itemizedDeduction: 0,
    deductionUsed: 'standard',
    deductionAmount: 15700,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
  },
  taxableOrdinaryIncome: 84300,
  taxableLTCG: 0,
  ordinaryIncomeBracketBreakdown: [
    { bracketMin: 0, bracketMax: 11925, rate: 0.10, incomeInBracket: 11925, taxForBracket: 1192.5 },
    { bracketMin: 11925, bracketMax: 48475, rate: 0.12, incomeInBracket: 36550, taxForBracket: 4386 },
    { bracketMin: 48475, bracketMax: 103350, rate: 0.22, incomeInBracket: 35825, taxForBracket: 7881.5 },
  ],
  ltcgBracketBreakdown: [],
  ordinaryIncomeTax: 13460,
  ltcgTax: 0,
  totalTax: 21110,
  withheld: 15000,
  estimatedPaid: 0,
  totalPaid: 15000,
  remainingOwed: 6110,
  refundDue: 0,
  ficaBreakdown: {
    socialSecurityTax: 6200,
    socialSecurityWages: 100000,
    medicareTax: 1450,
    additionalMedicareTax: 0,
    totalFica: 7650,
  },
  ...overrides,
});

describe('FederalBreakdown', () => {
  describe('income section', () => {
    it('displays federal income', () => {
      const result = createMockResult({ wageIncome: 150000 });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Federal Income')).toBeInTheDocument();
      expect(screen.getByText('$150,000')).toBeInTheDocument();
    });

    it('shows short-term capital gains when present', () => {
      const result = createMockResult({
        shortTermCapitalGains: 10000,
        grossIncome: 110000,
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Short-Term Capital Gains')).toBeInTheDocument();
    });

    it('shows long-term capital gains when present', () => {
      const result = createMockResult({
        longTermCapitalGains: 20000,
        grossIncome: 120000,
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Long-Term Capital Gains')).toBeInTheDocument();
    });

    it('shows gross income total', () => {
      const result = createMockResult({ grossIncome: 125000 });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Gross Income')).toBeInTheDocument();
    });
  });

  describe('deductions', () => {
    it('shows standard deduction when used', () => {
      const result = createMockResult();
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Less: Standard Deduction')).toBeInTheDocument();
    });

    it('shows itemized deduction when used', () => {
      const result = createMockResult({
        deductionBreakdown: {
          standardDeduction: 15700,
          itemizedDeduction: 25000,
          deductionUsed: 'itemized',
          deductionAmount: 25000,
          saltDeduction: 10000,
          saltCapped: true,
          mortgageInterest: 10000,
          charitableContributions: 5000,
        },
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Less: Itemized Deduction')).toBeInTheDocument();
      expect(screen.getByText('Itemized Deduction Breakdown:')).toBeInTheDocument();
    });

    it('shows 401k contributions when present', () => {
      const result = createMockResult({ contributions401k: 23000 });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Less: 401(k) Contributions')).toBeInTheDocument();
    });
  });

  describe('loss carryovers', () => {
    it('shows short-term carryover offset when present', () => {
      const result = createMockResult({ shortTermLossCarryoverOffset: 5000 });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Less: Short-Term Carryover Offset')).toBeInTheDocument();
    });

    it('shows long-term carryover offset when present', () => {
      const result = createMockResult({ longTermLossCarryoverOffset: 10000 });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Less: Long-Term Carryover Offset')).toBeInTheDocument();
    });

    it('shows preserved ST carryover when applicable', () => {
      const result = createMockResult({
        shortTermLossCarryoverOffset: 5000,
        shortTermLossCarryoverUnused: 2000,
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText(/Preserving.*ST carryover/)).toBeInTheDocument();
    });
  });

  describe('FICA taxes', () => {
    it('displays FICA breakdown', () => {
      const result = createMockResult();
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('FICA Taxes (Social Security & Medicare)')).toBeInTheDocument();
      expect(screen.getByText('Total FICA')).toBeInTheDocument();
    });

    it('shows additional Medicare when applicable', () => {
      const result = createMockResult({
        ficaBreakdown: {
          socialSecurityTax: 10918.2,
          socialSecurityWages: 176100,
          medicareTax: 3625,
          additionalMedicareTax: 450,
          totalFica: 14993.2,
        },
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText(/Additional Medicare/)).toBeInTheDocument();
    });
  });

  describe('bracket tables', () => {
    it('displays ordinary income bracket table', () => {
      const result = createMockResult();
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Ordinary Income Tax by Bracket')).toBeInTheDocument();
    });

    it('displays LTCG bracket table when there are gains', () => {
      const result = createMockResult({
        longTermCapitalGains: 50000,
        taxableLTCG: 50000,
        ltcgBracketBreakdown: [
          { bracketMin: 0, bracketMax: 47025, rate: 0, incomeInBracket: 47025, taxForBracket: 0 },
          { bracketMin: 47025, bracketMax: 518900, rate: 0.15, incomeInBracket: 2975, taxForBracket: 446.25 },
        ],
        ltcgTax: 446.25,
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Long-Term Capital Gains Tax by Bracket')).toBeInTheDocument();
    });
  });

  describe('safe harbor', () => {
    it('shows safe harbor section when tax is owed', () => {
      const result = createMockResult({
        remainingOwed: 5000,
        safeHarbor: {
          currentYear90Percent: 18999,
          priorYearSafeHarbor: 16500,
          minimum: 16500,
          met: false,
          remaining: 1500,
        },
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText('Safe Harbor (Penalty Avoidance)')).toBeInTheDocument();
    });

    it('shows safe harbor met message when criteria satisfied', () => {
      const result = createMockResult({
        remainingOwed: 1000,
        safeHarbor: {
          currentYear90Percent: 18999,
          priorYearSafeHarbor: 16500,
          minimum: 16500,
          met: true,
          remaining: 0,
        },
      });
      render(<FederalBreakdown result={result} />);

      expect(screen.getByText(/Safe Harbor Met/)).toBeInTheDocument();
    });
  });
});
