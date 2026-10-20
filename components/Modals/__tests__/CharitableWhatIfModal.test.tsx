import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CharitableWhatIfModal from "../CharitableWhatIfModal";
import { CharitableScenario } from "@/lib/charitableScenario";

// A filer for whom each dollar given saves 32 cents federally and 9 cents in
// state tax, after a $1,500 Federal floor
const scenario = (
  contributions: number,
  overrides: Partial<CharitableScenario> = {},
): CharitableScenario => ({
  federalTax: 60000 - Math.max(0, contributions - 1500) * 0.32,
  stateTax: 20000 - contributions * 0.09,
  federalFloor: 1500,
  federalItemizes: true,
  standardChosenForStateTax: false,
  federalHighIncomeReduction: 0,
  stateHighIncomeReduction: 0,
  ...overrides,
});

const renderModal = (
  props: Partial<React.ComponentProps<typeof CharitableWhatIfModal>> = {},
) =>
  render(
    <CharitableWhatIfModal
      isOpen={true}
      onClose={vi.fn()}
      currentContributions={10000}
      federalAgi={300000}
      stateLabel="California"
      calculateScenario={scenario}
      onApply={vi.fn()}
      {...props}
    />,
  );

const row = (label: string) =>
  screen.getByText(label).closest("tr")?.textContent ?? "";

describe("CharitableWhatIfModal", () => {
  it("shows Federal, state and total tax saved compared with giving nothing", () => {
    renderModal();

    // Current $10,000: Federal (10,000 - 1,500) x 32% = $2,720; state $900
    expect(row("Current")).toContain("$3,620");
    expect(row("Current")).toContain("Federal $2,720, State $900");
    // Double $20,000: Federal $5,920; state $1,800
    expect(row("Double")).toContain("$7,720");
    // Half $5,000: Federal $1,120; state $450
    expect(row("Half")).toContain("$1,570");
  });

  it("names the state only where there is state tax", () => {
    const { unmount } = renderModal();
    expect(
      screen.getByText(/What giving saves in Federal and California tax/),
    ).toBeInTheDocument();
    unmount();

    renderModal({
      stateLabel: "Florida",
      calculateScenario: (contributions) =>
        scenario(contributions, { stateTax: 0 }),
    });
    expect(
      screen.getByText(/What giving saves in Federal tax/),
    ).toBeInTheDocument();
  });

  it("leaves out notes that only fit some rows", () => {
    // Smaller gifts save state tax under the standard deduction; the
    // largest saves Federal tax only, as in Colorado
    renderModal({
      stateLabel: "Colorado",
      calculateScenario: (contributions) =>
        contributions > 10000
          ? scenario(contributions, { stateTax: 20000 })
          : scenario(contributions, {
              federalTax: 60000,
              federalItemizes: false,
              standardChosenForStateTax: true,
            }),
    });

    expect(screen.queryByText(/Where there is no saving/)).toBeNull();
    expect(screen.queryByText(/do not change your Colorado tax/)).toBeNull();
  });

  it("splits a saving that is all Federal or all state", () => {
    // Under the $1,500 Federal floor, a $1,000 gift saves state tax only
    renderModal({ currentContributions: 1000 });
    expect(row("Current")).toContain("Federal $0, State $90");
  });

  it("shows no split where there is no state tax", () => {
    renderModal({
      stateLabel: "Florida",
      calculateScenario: (contributions) =>
        scenario(contributions, { stateTax: 0 }),
    });
    expect(row("Current")).not.toContain("State");
  });

  it("says what doubling adds over the current gift", () => {
    renderModal();

    // Double saves $7,720 against $3,620 now: $4,100 more on an extra
    // $10,000, which leaves $5,900, or 59 cents per dollar
    expect(
      screen.getByText(
        "Doubling your gift saves a further $4,100, so the extra $10,000 costs $5,900 after tax (59¢ per $1).",
      ),
    ).toBeInTheDocument();
  });

  it("says when doubling saves nothing more", () => {
    renderModal({
      calculateScenario: (contributions) =>
        scenario(Math.min(contributions, 10000)),
    });

    expect(
      screen.getByText("Doubling your gift saves no further tax."),
    ).toBeInTheDocument();
  });

  it("shows what each gift costs after the tax saving", () => {
    renderModal();

    // $10,000 - $3,620 saved, which is 64 cents per dollar given
    expect(row("Current")).toContain("$6,380");
    expect(row("Current")).toContain("64¢ per $1 given");
    // $20,000 - $7,720 saved
    expect(row("Double")).toContain("$12,280");
    expect(row("Double")).toContain("61¢ per $1 given");
  });

  it("shows a state saving of zero where the state taxes income", () => {
    renderModal({
      calculateScenario: (contributions) =>
        scenario(contributions, { stateTax: 20000 }),
    });

    expect(row("Current")).toContain("Federal $2,720, State $0");
  });

  it("shows a gift that raises state tax as a negative, not as zero", () => {
    // The state tax rises by $1,000 once anything is given
    renderModal({
      stateLabel: "DC",
      calculateScenario: (contributions) =>
        scenario(contributions, {
          stateTax: contributions > 0 ? 21000 : 20000,
        }),
    });

    // Federal $2,720 saved, state $1,000 more
    expect(row("Current")).toContain("Federal $2,720, State -$1,000");
    expect(row("Current")).toContain("$1,720");
    expect(
      screen.getByText(/can raise DC tax while lowering the total/),
    ).toBeInTheDocument();
  });

  it("states the Federal floor", () => {
    renderModal();

    expect(
      screen.getByText(
        "The first $1,500 of giving each year is not deductible federally.",
      ),
    ).toBeInTheDocument();
  });

  it("explains a missing Federal saving when the standard deduction is larger", () => {
    renderModal({
      calculateScenario: (contributions) =>
        scenario(contributions, {
          federalTax: 60000,
          federalFloor: 0,
          federalItemizes: false,
        }),
    });

    expect(
      screen.getByText(/the standard deduction is still larger/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/not deductible federally/),
    ).not.toBeInTheDocument();
  });

  it("does not mention income-based limits that the gift does not change", () => {
    // Reductions that are the same with or without the gift
    renderModal({
      calculateScenario: (contributions) =>
        scenario(contributions, {
          federalHighIncomeReduction: 4000,
          stateHighIncomeReduction: 3000,
        }),
    });

    expect(screen.queryByText(/top-bracket income/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/allows only part of each gift/),
    ).not.toBeInTheDocument();
  });

  it("mentions income-based limits that grow with the gift", () => {
    renderModal({
      stateLabel: "New York",
      calculateScenario: (contributions) =>
        scenario(contributions, {
          federalHighIncomeReduction: contributions * 0.05,
          stateHighIncomeReduction: contributions * 0.5,
        }),
    });

    expect(
      screen.getByText(/Federal limit on itemized deductions for top-bracket/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/New York allows only part of each gift/),
    ).toBeInTheDocument();
  });

  it("says when the gifts do not change state tax", () => {
    renderModal({
      stateLabel: "Colorado",
      calculateScenario: (contributions) =>
        scenario(contributions, { stateTax: 20000 }),
    });

    expect(
      screen.getByText("These gifts do not change your Colorado tax."),
    ).toBeInTheDocument();
  });

  it("does not say that where the state has no income tax", () => {
    renderModal({
      stateLabel: "Florida",
      calculateScenario: (contributions) =>
        scenario(contributions, { stateTax: 0 }),
    });

    expect(screen.queryByText(/do not change your/)).not.toBeInTheDocument();
  });

  it("cautions about percentage limits only when a scenario is over 30% of income", () => {
    const { unmount } = renderModal();
    expect(
      screen.queryByText(/Gifts above 30% of income/),
    ).not.toBeInTheDocument();
    unmount();

    renderModal({ currentContributions: 60000 });
    expect(screen.getByText(/Gifts above 30% of income/)).toBeInTheDocument();
  });

  it("always mentions the gain avoided by donating appreciated investments", () => {
    renderModal();

    expect(
      screen.getByText(/appreciated investments also avoids tax on the gain/),
    ).toBeInTheDocument();
  });

  it("applies a scenario's amount and closes", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderModal({ onApply, onClose });

    await userEvent.click(screen.getByRole("button", { name: "Use $20,000" }));

    expect(onApply).toHaveBeenCalledWith(20000);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("is a labelled dialog that takes focus", () => {
    renderModal();

    expect(
      screen.getByRole("dialog", {
        name: "Charitable Contributions: What If?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Close")).toHaveFocus();
  });

  it("keeps Tab inside the dialog", async () => {
    renderModal();
    const dialog = screen.getByRole("dialog");

    // Focus starts on the last button, so Tab wraps to the first
    await userEvent.tab();
    const [xButton] = screen.getAllByRole("button", { name: "Close" });
    expect(xButton).toHaveFocus();

    // And Shift+Tab wraps back to the last
    await userEvent.tab({ shift: true });
    expect(screen.getByText("Close")).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("renders nothing when closed", () => {
    const { container } = renderModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });
});
