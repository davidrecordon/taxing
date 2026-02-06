import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigurationSection from "../ConfigurationSection";
import { SUPPORTED_YEARS, TAX_YEAR } from "@/lib/config";

describe("ConfigurationSection", () => {
  const defaultProps = {
    filingStatus: "single" as const,
    selectedState: "california" as const,
    taxYear: TAX_YEAR,
    onFilingStatusChange: vi.fn(),
    onStateChange: vi.fn(),
    onTaxYearChange: vi.fn(),
  };

  describe("tax year dropdown", () => {
    it("renders all supported years", () => {
      render(<ConfigurationSection {...defaultProps} />);

      for (const year of SUPPORTED_YEARS) {
        expect(screen.getByText(year)).toBeInTheDocument();
      }
    });

    it("shows current tax year as selected", () => {
      render(<ConfigurationSection {...defaultProps} />);

      const selects = screen.getAllByRole("combobox");
      expect(selects[0]).toHaveValue(TAX_YEAR);
    });

    it("calls onTaxYearChange when selection changes", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <ConfigurationSection
          {...defaultProps}
          onTaxYearChange={handleChange}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      const otherYear = SUPPORTED_YEARS.find((y) => y !== TAX_YEAR)!;
      await user.selectOptions(selects[0], otherYear);

      expect(handleChange).toHaveBeenCalledWith(otherYear);
    });
  });

  describe("filing status dropdown", () => {
    it("renders all filing status options", () => {
      render(<ConfigurationSection {...defaultProps} />);

      expect(screen.getByText("Single")).toBeInTheDocument();
      expect(screen.getByText("Married Filing Jointly")).toBeInTheDocument();
      expect(screen.getByText("Married Filing Separately")).toBeInTheDocument();
    });

    it("shows current filing status as selected", () => {
      render(
        <ConfigurationSection
          {...defaultProps}
          filingStatus="marriedFilingJointly"
        />,
      );

      const selects = screen.getAllByRole("combobox");
      expect(selects[1]).toHaveValue("marriedFilingJointly");
    });

    it("calls onFilingStatusChange when selection changes", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <ConfigurationSection
          {...defaultProps}
          onFilingStatusChange={handleChange}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[1], "marriedFilingJointly");

      expect(handleChange).toHaveBeenCalledWith("marriedFilingJointly");
    });
  });

  describe("state dropdown", () => {
    it("renders all state options", () => {
      render(<ConfigurationSection {...defaultProps} />);

      expect(screen.getByText("California")).toBeInTheDocument();
      expect(screen.getByText("New York")).toBeInTheDocument();
      expect(screen.getByText("Washington")).toBeInTheDocument();
    });

    it("shows current state as selected", () => {
      render(
        <ConfigurationSection {...defaultProps} selectedState="washington" />,
      );

      const selects = screen.getAllByRole("combobox");
      expect(selects[2]).toHaveValue("washington");
    });

    it("calls onStateChange when selection changes", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <ConfigurationSection {...defaultProps} onStateChange={handleChange} />,
      );

      const selects = screen.getAllByRole("combobox");
      await user.selectOptions(selects[2], "newyork");

      expect(handleChange).toHaveBeenCalledWith("newyork");
    });
  });

  describe("NYC resident checkbox", () => {
    it("is hidden when state is not New York", () => {
      render(
        <ConfigurationSection
          {...defaultProps}
          selectedState="california"
          onNYCResidentChange={vi.fn()}
        />,
      );

      expect(screen.queryByText("NYC Resident")).not.toBeInTheDocument();
    });

    it("is visible when state is New York", () => {
      render(
        <ConfigurationSection
          {...defaultProps}
          selectedState="newyork"
          onNYCResidentChange={vi.fn()}
        />,
      );

      expect(screen.getByText("NYC Resident")).toBeInTheDocument();
    });

    it("calls onNYCResidentChange when checked", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <ConfigurationSection
          {...defaultProps}
          selectedState="newyork"
          isNYCResident={false}
          onNYCResidentChange={handleChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it("shows checked state correctly", () => {
      render(
        <ConfigurationSection
          {...defaultProps}
          selectedState="newyork"
          isNYCResident={true}
          onNYCResidentChange={vi.fn()}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });
  });
});
