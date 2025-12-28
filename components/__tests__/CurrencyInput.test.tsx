import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CurrencyInput from '../CurrencyInput';

describe('CurrencyInput', () => {
  describe('rendering', () => {
    it('renders with label', () => {
      render(
        <CurrencyInput label="Test Label" value={0} onChange={() => {}} />
      );
      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    });

    it('displays dollar sign prefix', () => {
      render(
        <CurrencyInput label="Amount" value={0} onChange={() => {}} />
      );
      expect(screen.getByText('$')).toBeInTheDocument();
    });

    it('shows current value in input with comma formatting', () => {
      render(
        <CurrencyInput label="Amount" value={1000} onChange={() => {}} />
      );
      expect(screen.getByRole('textbox')).toHaveValue('1,000');
    });

    it('formats large numbers with commas', () => {
      render(
        <CurrencyInput label="Amount" value={1234567} onChange={() => {}} />
      );
      expect(screen.getByRole('textbox')).toHaveValue('1,234,567');
    });

    it('shows empty input when value is 0', () => {
      render(
        <CurrencyInput label="Amount" value={0} onChange={() => {}} />
      );
      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });

  describe('hint/warning/error messages', () => {
    it('displays hint text', () => {
      render(
        <CurrencyInput
          label="Amount"
          value={0}
          onChange={() => {}}
          hint="This is a hint"
        />
      );
      expect(screen.getByText('This is a hint')).toBeInTheDocument();
    });

    it('displays warning text', () => {
      render(
        <CurrencyInput
          label="Amount"
          value={0}
          onChange={() => {}}
          warning="This is a warning"
        />
      );
      expect(screen.getByText('This is a warning')).toBeInTheDocument();
    });

    it('displays error text', () => {
      render(
        <CurrencyInput
          label="Amount"
          value={0}
          onChange={() => {}}
          error="This is an error"
        />
      );
      expect(screen.getByText('This is an error')).toBeInTheDocument();
    });

    it('shows error over warning when both present', () => {
      render(
        <CurrencyInput
          label="Amount"
          value={0}
          onChange={() => {}}
          warning="Warning"
          error="Error"
        />
      );
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    });

    it('shows warning over hint when both present', () => {
      render(
        <CurrencyInput
          label="Amount"
          value={0}
          onChange={() => {}}
          hint="Hint"
          warning="Warning"
        />
      );
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.queryByText('Hint')).not.toBeInTheDocument();
    });
  });

  describe('user input', () => {
    it('calls onChange when user types', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <CurrencyInput label="Amount" value={0} onChange={handleChange} />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '1234');

      // onChange is called on each keystroke
      expect(handleChange).toHaveBeenCalled();
      // Called 4 times for 4 keystrokes
      expect(handleChange).toHaveBeenCalledTimes(4);
    });

    it('filters out non-numeric characters from onChange calls', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <CurrencyInput label="Amount" value={0} onChange={handleChange} />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'abc');

      // Letters are filtered out, so onChange is called with 0 (empty input parses to 0)
      expect(handleChange).toHaveBeenCalled();
      handleChange.mock.calls.forEach((call) => {
        expect(call[0]).toBe(0); // All calls should be 0 since letters are filtered
      });
    });

    it('parses numeric input correctly', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <CurrencyInput label="Amount" value={0} onChange={handleChange} />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, '5');

      // Single digit should parse correctly
      expect(handleChange).toHaveBeenLastCalledWith(5);
    });
  });

});
