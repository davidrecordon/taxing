import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilingStatusComparisonModal, {
  SplitConfig,
  MFSScenarioResult,
} from '../FilingStatusComparisonModal';
import { TaxInputs } from '@/lib/types';

describe('FilingStatusComparisonModal', () => {
  const defaultInputs: TaxInputs = {
    federalIncome: 150000,
    stateIncome: 150000,
    shortTermCapitalGains: 10000,
    longTermCapitalGains: 50000,
    federalTaxWithheld: 30000,
    stateTaxWithheld: 10000,
    federalEstimatedPaid: 0,
    stateEstimatedPaid: 0,
    filingStatus: 'marriedFilingJointly',
    selectedState: 'california',
    propertyTaxesPaid: 15000,
    mortgageInterestPaid: 20000,
    mortgageBalance: 500000,
    charitableContributions: 5000,
    contributions401k: 20000,
    preTaxMedical: 5000,
    priorYearFederalTaxPaid: 40000,
    priorYearStateTaxPaid: 12000,
    priorYearShortTermLossCarryover: 0,
    priorYearLongTermLossCarryover: 0,
    selfEmploymentIncome: 0,
  };

  const mfjResults = {
    federalTax: 45000,
    stateTax: 12000,
    totalTax: 57000,
  };

  const mockMFSScenario = vi.fn((splits: SplitConfig): MFSScenarioResult => ({
    spouse1: {
      federalTax: 25000,
      stateTax: 7000,
      totalTax: 32000,
    },
    spouse2: {
      federalTax: 23000,
      stateTax: 6500,
      totalTax: 29500,
    },
    combined: {
      federalTax: 48000,
      stateTax: 13500,
      totalTax: 61500,
    },
  }));

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentInputs: defaultInputs,
    mfjResults,
    calculateMFSScenario: mockMFSScenario,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('modal visibility', () => {
    it('renders when isOpen is true', () => {
      render(<FilingStatusComparisonModal {...defaultProps} />);
      expect(screen.getByText('Compare MFJ vs MFS')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<FilingStatusComparisonModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Compare MFJ vs MFS')).not.toBeInTheDocument();
    });
  });

  describe('split sliders', () => {
    it('renders sliders for non-zero income categories', () => {
      render(<FilingStatusComparisonModal {...defaultProps} />);

      // Using getAllByText since responsive design renders both mobile and desktop layouts
      expect(screen.getAllByText(/Wages/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/STCG/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/LTCG/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/401\(k\)/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Pre-Tax Medical/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Deductions/).length).toBeGreaterThan(0);
    });

    it('hides sliders for zero-value categories', () => {
      const inputsWithZeroSTCG = { ...defaultInputs, shortTermCapitalGains: 0 };
      render(
        <FilingStatusComparisonModal
          {...defaultProps}
          currentInputs={inputsWithZeroSTCG}
        />
      );

      // STCG slider should not be visible when value is 0
      const sliders = screen.getAllByRole('slider');
      // Should have fewer sliders when STCG is 0
      // 5 categories × 2 layouts (mobile + desktop) = 10 sliders
      expect(sliders.length).toBe(10);
    });

    it('updates calculation when slider changes', () => {
      render(<FilingStatusComparisonModal {...defaultProps} />);

      const sliders = screen.getAllByRole('slider');
      fireEvent.change(sliders[0], { target: { value: '70' } });

      // Calculation should be called with new splits
      expect(mockMFSScenario).toHaveBeenCalled();
    });
  });

  describe('results table', () => {
    it('displays MFJ results', () => {
      render(<FilingStatusComparisonModal {...defaultProps} />);

      expect(screen.getByText('$45,000')).toBeInTheDocument(); // Federal
      expect(screen.getByText('$12,000')).toBeInTheDocument(); // State
      expect(screen.getByText('$57,000')).toBeInTheDocument(); // Total
    });

    it('displays MFS combined results', () => {
      render(<FilingStatusComparisonModal {...defaultProps} />);

      expect(screen.getByText('$48,000')).toBeInTheDocument(); // Federal combined
      expect(screen.getByText('$13,500')).toBeInTheDocument(); // State combined
      expect(screen.getByText('$61,500')).toBeInTheDocument(); // Total combined
    });

    it('shows difference with correct color for higher MFS taxes', () => {
      render(<FilingStatusComparisonModal {...defaultProps} />);

      // MFS is higher, so difference should be red
      const differences = screen.getAllByText(/\+\$\d/);
      expect(differences.length).toBeGreaterThan(0);
      expect(differences[0]).toHaveClass('text-red-600');
    });

  });

  describe('close button', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <FilingStatusComparisonModal {...defaultProps} onClose={handleClose} />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
      const handleClose = vi.fn();
      render(
        <FilingStatusComparisonModal {...defaultProps} onClose={handleClose} />
      );

      // Click on the backdrop (first fixed element with bg-black)
      const backdrop = document.querySelector('.bg-black.bg-opacity-50');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(handleClose).toHaveBeenCalled();
      }
    });

    it('calls onClose when X button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <FilingStatusComparisonModal {...defaultProps} onClose={handleClose} />
      );

      // Find the X button (SVG with path)
      const xButton = screen.getByRole('button', { name: '' });
      if (xButton) {
        fireEvent.click(xButton);
        expect(handleClose).toHaveBeenCalled();
      }
    });
  });

});
