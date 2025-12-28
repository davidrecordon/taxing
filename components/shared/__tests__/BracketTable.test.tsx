import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BracketTable from '../BracketTable';
import { BracketBreakdown } from '@/lib/types';

const sampleBreakdown: BracketBreakdown[] = [
  { bracketMin: 0, bracketMax: 11925, rate: 0.10, incomeInBracket: 11925, taxForBracket: 1192.5 },
  { bracketMin: 11925, bracketMax: 48475, rate: 0.12, incomeInBracket: 36550, taxForBracket: 4386 },
  { bracketMin: 48475, bracketMax: 103350, rate: 0.22, incomeInBracket: 10000, taxForBracket: 2200 },
];

describe('BracketTable', () => {
  describe('rendering', () => {
    it('renders title', () => {
      render(
        <BracketTable
          breakdown={sampleBreakdown}
          title="Ordinary Income Tax by Bracket"
          totalLabel="Total Tax:"
          totalAmount={7778.5}
        />
      );
      expect(screen.getByText('Ordinary Income Tax by Bracket')).toBeInTheDocument();
    });

    it('renders all bracket rows', () => {
      render(
        <BracketTable
          breakdown={sampleBreakdown}
          title="Test"
          totalLabel="Total:"
          totalAmount={7778.5}
        />
      );
      // Check for rates in the table
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
      expect(screen.getByText('22%')).toBeInTheDocument();
    });

    it('renders total row with label and amount', () => {
      render(
        <BracketTable
          breakdown={sampleBreakdown}
          title="Test"
          totalLabel="Total Tax:"
          totalAmount={7778.5}
        />
      );
      expect(screen.getByText('Total Tax:')).toBeInTheDocument();
      expect(screen.getByText('$7,779')).toBeInTheDocument();
    });

    it('shows custom income label', () => {
      render(
        <BracketTable
          breakdown={sampleBreakdown}
          title="Test"
          incomeLabel="Gains"
          totalLabel="Total:"
          totalAmount={7778.5}
        />
      );
      expect(screen.getByText('Gains')).toBeInTheDocument();
    });

    it('shows footnote when provided', () => {
      render(
        <BracketTable
          breakdown={sampleBreakdown}
          title="Test"
          totalLabel="Total:"
          totalAmount={7778.5}
          footnote="This is a footnote"
        />
      );
      expect(screen.getByText('This is a footnote')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('returns null when breakdown is empty', () => {
      const { container } = render(
        <BracketTable
          breakdown={[]}
          title="Test"
          totalLabel="Total:"
          totalAmount={0}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('handles bracket with null max (top bracket)', () => {
      const topBracket: BracketBreakdown[] = [
        { bracketMin: 626350, bracketMax: null, rate: 0.37, incomeInBracket: 100000, taxForBracket: 37000 },
      ];

      render(
        <BracketTable
          breakdown={topBracket}
          title="Test"
          totalLabel="Total:"
          totalAmount={37000}
        />
      );
      // Should show "..." for unlimited bracket
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });
});
