import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CharitableWhatIfModal from "../CharitableWhatIfModal";

const scenario = (totalTax: number, paid: number) => ({
  totalTax,
  remainingOwed: Math.max(0, totalTax - paid),
  refundDue: Math.max(0, paid - totalTax),
  effectiveRate: totalTax / 300000,
});

const renderModal = (paid: number) =>
  render(
    <CharitableWhatIfModal
      isOpen={true}
      onClose={vi.fn()}
      currentContributions={10000}
      federalAgi={300000}
      currentResults={scenario(50000, paid)}
      // Each dollar given saves 32 cents
      calculateScenario={(contributions) =>
        scenario(50000 - (contributions - 10000) * 0.32, paid)
      }
      onApply={vi.fn()}
    />,
  );

describe("CharitableWhatIfModal", () => {
  it("shows the amount owed for each scenario", () => {
    renderModal(40000);

    // Half: $51,600 tax; current: $50,000; double: $46,800
    expect(screen.getByText("$11,600 owed")).toBeInTheDocument();
    expect(screen.getByText("$10,000 owed")).toBeInTheDocument();
    expect(screen.getByText("$6,800 owed")).toBeInTheDocument();
  });

  it("shows the refund for each scenario when more was paid than is due", () => {
    renderModal(60000);

    expect(screen.getByText("$8,400 refund")).toBeInTheDocument();
    expect(screen.getByText("$10,000 refund")).toBeInTheDocument();
    expect(screen.getByText("$13,200 refund")).toBeInTheDocument();
  });

  it("shows the tax impact of each scenario", () => {
    renderModal(40000);

    expect(screen.getByText("+$1,600")).toBeInTheDocument();
    expect(screen.getByText("-$3,200")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <CharitableWhatIfModal
        isOpen={false}
        onClose={vi.fn()}
        currentContributions={10000}
        federalAgi={300000}
        currentResults={scenario(50000, 40000)}
        calculateScenario={() => scenario(50000, 40000)}
        onApply={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
