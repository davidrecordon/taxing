import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaxSummarySection from '../shared/TaxSummarySection';

describe('TaxSummarySection', () => {
  describe('tax owed scenario', () => {
    it('shows remaining owed in red', () => {
      render(
        <TaxSummarySection
          totalTax={10000}
          withheld={5000}
          estimatedPaid={2000}
          remainingOwed={3000}
          refundDue={0}
          taxLabel="Federal"
        />
      );
      expect(screen.getByText('$3,000')).toBeInTheDocument();
      expect(screen.getByText('Estimated Tax Still Owed')).toBeInTheDocument();
    });

    it('shows withheld and estimated payments', () => {
      render(
        <TaxSummarySection
          totalTax={10000}
          withheld={5000}
          estimatedPaid={2000}
          remainingOwed={3000}
          refundDue={0}
          taxLabel="Federal"
        />
      );
      expect(screen.getByText('-$5,000')).toBeInTheDocument();
      expect(screen.getByText('-$2,000')).toBeInTheDocument();
    });
  });

  describe('refund scenario', () => {
    it('shows refund in green', () => {
      render(
        <TaxSummarySection
          totalTax={10000}
          withheld={12000}
          estimatedPaid={0}
          remainingOwed={0}
          refundDue={2000}
          taxLabel="Federal"
        />
      );
      expect(screen.getByText('$2,000')).toBeInTheDocument();
      expect(screen.getByText('Estimated Refund')).toBeInTheDocument();
    });
  });

  describe('no tax scenario', () => {
    it('shows no tax due message', () => {
      render(
        <TaxSummarySection
          totalTax={0}
          withheld={0}
          estimatedPaid={0}
          remainingOwed={0}
          refundDue={0}
          taxLabel="Federal"
        />
      );
      expect(screen.getByText('No Tax Due')).toBeInTheDocument();
    });
  });

  describe('effective rates', () => {
    it('shows effective rates when enabled', () => {
      render(
        <TaxSummarySection
          totalTax={10000}
          withheld={0}
          estimatedPaid={0}
          remainingOwed={10000}
          refundDue={0}
          taxLabel="Federal"
          showEffectiveRates={true}
          effectiveRates={{ onTaxableIncome: 0.15, onGrossIncome: 0.12 }}
        />
      );
      expect(screen.getByText('Effective Rate (on taxable income)')).toBeInTheDocument();
      expect(screen.getByText('Effective Rate (on gross income)')).toBeInTheDocument();
      expect(screen.getByText('15%')).toBeInTheDocument();
      expect(screen.getByText('12%')).toBeInTheDocument();
    });

    it('hides effective rates when disabled', () => {
      render(
        <TaxSummarySection
          totalTax={10000}
          withheld={0}
          estimatedPaid={0}
          remainingOwed={10000}
          refundDue={0}
          taxLabel="Federal"
          showEffectiveRates={false}
        />
      );
      expect(screen.queryByText('Effective Rate (on taxable income)')).not.toBeInTheDocument();
    });
  });

  describe('tax label', () => {
    it('uses custom tax label', () => {
      render(
        <TaxSummarySection
          totalTax={5000}
          withheld={0}
          estimatedPaid={0}
          remainingOwed={5000}
          refundDue={0}
          taxLabel="California"
        />
      );
      expect(screen.getByText('Total California Tax')).toBeInTheDocument();
    });
  });

  describe('hides zero payments', () => {
    it('does not show withheld row when zero', () => {
      render(
        <TaxSummarySection
          totalTax={5000}
          withheld={0}
          estimatedPaid={1000}
          remainingOwed={4000}
          refundDue={0}
          taxLabel="Federal"
        />
      );
      expect(screen.queryByText('Less: Withheld')).not.toBeInTheDocument();
      expect(screen.getByText('Less: Estimated Paid')).toBeInTheDocument();
    });

    it('does not show estimated paid row when zero', () => {
      render(
        <TaxSummarySection
          totalTax={5000}
          withheld={1000}
          estimatedPaid={0}
          remainingOwed={4000}
          refundDue={0}
          taxLabel="Federal"
        />
      );
      expect(screen.getByText('Less: Withheld')).toBeInTheDocument();
      expect(screen.queryByText('Less: Estimated Paid')).not.toBeInTheDocument();
    });
  });
});
