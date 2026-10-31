import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WithholdingInputs from "../WithholdingInputs";
import { TaxInputs } from "@/lib/types";
import { createDefaultInputs } from "@/lib/__tests__/testData";
import { WithholdingEstimate } from "@/lib/withholdingEstimate";

const renderWithholding = (
  overrides: Partial<TaxInputs> = {},
  onUpdate = vi.fn(),
  estimate?: WithholdingEstimate,
) =>
  render(
    <WithholdingInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={onUpdate}
      estimate={estimate}
    />,
  );

const estimate: WithholdingEstimate = {
  federal: 52854,
  federalRegular: 30854,
  federalSupplemental: 22000,
  state: 22320.36,
  stateRegular: 12090.36,
  stateSupplemental: 10230,
};

describe("WithholdingInputs", () => {
  it("labels the state fields for the selected state", () => {
    renderWithholding({ selectedState: "newyork" });

    expect(screen.getByLabelText("New York Tax Withheld")).toBeInTheDocument();
    expect(
      screen.getByLabelText("New York Estimated Paid"),
    ).toBeInTheDocument();
  });

  it("asks for the full year's withholding", () => {
    renderWithholding();

    expect(
      screen.getAllByText("Expected for the full year, from paychecks"),
    ).toHaveLength(2);
  });

  describe("the estimate from wages", () => {
    it("is shown under a blank withholding field", () => {
      renderWithholding({ federalIncome: 300000 }, vi.fn(), estimate);

      expect(
        screen.getByText(/Estimated at \$52,854 from your wages/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Estimated at \$22,320 from your wages/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Expected for the full year, from paychecks"),
      ).not.toBeInTheDocument();
    });

    it("gives way to an amount the user enters", () => {
      renderWithholding(
        { federalIncome: 300000, federalTaxWithheld: 60000 },
        vi.fn(),
        estimate,
      );

      expect(
        screen.queryByText(/Estimated at \$52,854/),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("Expected for the full year, from paychecks"),
      ).toBeInTheDocument();
      expect(screen.getByText(/Estimated at \$22,320/)).toBeInTheDocument();
    });

    it("is not offered for a state whose withholding is not estimated", () => {
      renderWithholding(
        { federalIncome: 300000, selectedState: "newyork" },
        vi.fn(),
        { ...estimate, state: null, stateRegular: 0, stateSupplemental: 0 },
      );

      expect(screen.getByText(/Estimated at \$52,854/)).toBeInTheDocument();
      expect(
        screen.getByText("Expected for the full year, from paychecks"),
      ).toBeInTheDocument();
    });
  });

  describe("typing in a field", () => {
    it.each<[string, keyof TaxInputs]>([
      ["Federal Tax Withheld", "federalTaxWithheld"],
      ["California Tax Withheld", "stateTaxWithheld"],
      ["Federal Estimated Paid", "federalEstimatedPaid"],
      ["California Estimated Paid", "stateEstimatedPaid"],
    ])("%s updates %s", async (label, field) => {
      const onUpdate = vi.fn();
      renderWithholding({}, onUpdate);

      await userEvent.type(screen.getByLabelText(label), "5000");

      expect(onUpdate).toHaveBeenLastCalledWith(field, 5000);
    });
  });
});
