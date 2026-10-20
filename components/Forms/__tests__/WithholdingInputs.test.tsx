import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WithholdingInputs from "../WithholdingInputs";
import { TaxInputs } from "@/lib/types";
import { createDefaultInputs } from "@/lib/__tests__/testData";

const renderWithholding = (
  overrides: Partial<TaxInputs> = {},
  onUpdate = vi.fn(),
) =>
  render(
    <WithholdingInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={onUpdate}
    />,
  );

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
