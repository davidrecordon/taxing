import { beforeAll, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaxCalculator from "../TaxCalculator";

// The whole app, from typing into the form to the charitable what-if tool,
// so the wiring between inputs, calculators and the tool is covered
describe("TaxCalculator", () => {
  // jsdom has no matchMedia, which the theme selector reads
  beforeAll(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  const enter = async (label: string, value: string) => {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    await userEvent.type(input, value);
    await userEvent.tab();
  };

  it("offers the charitable what-if tool with Federal and state savings", async () => {
    render(<TaxCalculator />);

    await userEvent.selectOptions(screen.getByLabelText("State"), "colorado");
    await screen.findByLabelText("Colorado Tax Withheld");

    await enter("Wages & Other Income", "150000");
    await enter("Colorado Tax Withheld", "6000");
    await enter("Property Taxes Paid", "6000");
    expect(
      screen.queryByRole("button", { name: "What if..." }),
    ).not.toBeInTheDocument();

    await enter("Charitable Contributions", "5000");
    await userEvent.click(
      await screen.findByRole("button", { name: "What if..." }),
    );

    // Single, 2026. Itemizing would gain $150 x 24% = $36 federally and lose
    // Colorado's subtraction of ($5,000 - $500) x 4.4% = $198, so the
    // standard deduction is kept and the saving is all Colorado's.
    // Doubled, itemizing wins: ($12,000 + $10,000 - $750 - $16,100) x 24% =
    // $1,236, and Colorado adds the extra deduction back.
    const dialog = within(screen.getByRole("dialog"));
    const row = (label: string) =>
      dialog.getByText(label).closest("tr")?.textContent ?? "";
    expect(row("Current")).toContain("Federal $0, State $198");
    expect(row("Double")).toContain("Federal $1,236, State $0");
  });
});
