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

  it("compares married filing jointly with filing separately", async () => {
    render(<TaxCalculator />);

    await userEvent.selectOptions(
      screen.getByLabelText("Filing Status"),
      "marriedFilingJointly",
    );
    await userEvent.selectOptions(screen.getByLabelText("State"), "florida");
    await screen.findByLabelText("Florida Tax Withheld");
    await enter("Wages & Other Income", "232200");
    await userEvent.click(
      screen.getByRole("button", { name: "Compare MFJ vs MFS" }),
    );

    // 2026 joint: $232,200 less the $32,200 standard deduction is $200,000.
    // 10% x $24,800 + 12% x $76,000 + 22% x $99,200 = $33,424.
    // Split evenly, each spouse has $100,000 on a schedule with half the
    // joint thresholds, so the two returns add up to the same tax.
    const dialog = within(
      screen.getByRole("dialog", { name: "Compare MFJ vs MFS" }),
    );
    const federalRow =
      dialog.getByText("Federal Tax").closest("tr")?.textContent ?? "";
    expect(federalRow).toBe("Federal Tax$33,424$33,424No change");
  });

  it("estimates withholding from wages until an amount is entered", async () => {
    render(<TaxCalculator />);
    await screen.findByLabelText("California Tax Withheld");

    await enter("Wages & Other Income", "300000");
    await enter("Of which Bonuses & Stock", "100000");

    // Single, California, 2026. Federal: regular wages $200,000 less $16,100
    // is $183,900, taxed 10% x $12,400 + 12% x $38,000 + 22% x $55,300 +
    // 24% x $78,200 = $36,734; the $100,000 of bonuses at 22% adds $22,000,
    // so $58,734. California: $200,000 less $5,900 is $194,100, taxed
    // $3,310.88 + 9.3% x $118,903 = $14,368.86; bonuses at 10.23% add
    // $10,230, so $24,599.
    expect(
      await screen.findByText(/Estimated at \$58,734 from your wages/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Estimated at \$24,599 from your wages/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Less: Withheld (estimated)")).toHaveLength(2);

    await enter("Federal Tax Withheld", "60000");

    expect(
      screen.queryByText(/Estimated at \$58,734/),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Less: Withheld (estimated)")).toHaveLength(1);
    expect(screen.getByText("Less: Withheld")).toBeInTheDocument();
  });

  it("recalculates for the tax year chosen", async () => {
    render(<TaxCalculator />);
    await enter("Wages & Other Income", "100000");

    // 2026 single: $100,000 less $16,100 is $83,900.
    // 10% x $12,400 + 12% x $38,000 + 22% x $33,500 = $13,170
    expect(screen.getAllByText("$13,170").length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText("Tax Year"), "2025");

    expect(screen.queryByText("$13,170")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /2025 Estimated Tax/ }),
    ).toBeInTheDocument();
  });

  it("does not refer to tax forms anywhere on the page", () => {
    render(<TaxCalculator />);

    expect(document.body.textContent).not.toMatch(
      /W-2|1099|1040|Schedule [A-Z]\b|\bbox \d/i,
    );
  });
});
