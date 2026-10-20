import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import Dialog from "../Dialog";

// The dialogs in Modals/ only check their own content; everything about
// opening, closing and the keyboard is tested here

const renderDialog = (onClose = vi.fn()) => {
  render(
    <Dialog title="Example Title" onClose={onClose}>
      <button>Inside</button>
    </Dialog>,
  );
  return onClose;
};

// The X button is named by its label; the footer button by its text
const xButton = () => screen.getAllByRole("button", { name: "Close" })[0];
const footerButton = () => screen.getByText("Close");

// A page with a button that opens the dialog, as the app uses it
function Page() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      {isOpen && (
        <Dialog title="Example Title" onClose={() => setIsOpen(false)}>
          <p>Content</p>
        </Dialog>
      )}
    </>
  );
}

describe("Dialog", () => {
  describe("content", () => {
    it("is announced as a modal dialog named by its title", () => {
      renderDialog();

      const dialog = screen.getByRole("dialog", { name: "Example Title" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("shows its children between the title and the Close button", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: "Inside" })).toBeVisible();
    });

    it("is wider when asked to be large", () => {
      render(
        <Dialog title="Wide" onClose={vi.fn()} size="large">
          <p>Content</p>
        </Dialog>,
      );

      expect(screen.getByRole("dialog")).toHaveClass("sm:max-w-4xl");
    });
  });

  describe("closing", () => {
    it("closes from the X button", async () => {
      const onClose = renderDialog();

      await userEvent.click(xButton());

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes from the Close button in the footer", async () => {
      const onClose = renderDialog();

      await userEvent.click(footerButton());

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes when the backdrop is clicked", async () => {
      const onClose = renderDialog();
      const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/50");
      expect(backdrop).not.toBeNull();

      await userEvent.click(backdrop!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("stays open when the dialog itself is clicked", async () => {
      const onClose = renderDialog();

      await userEvent.click(screen.getByRole("dialog"));

      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes on Escape", async () => {
      const onClose = renderDialog();

      await userEvent.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard focus", () => {
    it("starts on the Close button in the footer", () => {
      renderDialog();

      expect(footerButton()).toHaveFocus();
    });

    it("wraps from the last control to the first on Tab", async () => {
      renderDialog();

      await userEvent.tab();

      expect(xButton()).toHaveFocus();
    });

    it("wraps from the first control to the last on Shift+Tab", async () => {
      renderDialog();
      await userEvent.tab();

      await userEvent.tab({ shift: true });

      expect(footerButton()).toHaveFocus();
    });

    it("moves through the controls inside in order", async () => {
      renderDialog();

      await userEvent.tab();
      await userEvent.tab();

      expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    });

    it("pulls focus back in if it has left the dialog", async () => {
      render(
        <>
          <button>Outside</button>
          <Dialog title="Example Title" onClose={vi.fn()}>
            <p>Content</p>
          </Dialog>
        </>,
      );
      screen.getByRole("button", { name: "Outside" }).focus();

      await userEvent.tab();

      expect(screen.getByRole("dialog")).toContainElement(
        document.activeElement as HTMLElement,
      );
    });

    it("returns to the control that opened it when it closes", async () => {
      render(<Page />);
      const opener = screen.getByRole("button", { name: "Open" });

      await userEvent.click(opener);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });

    it("does not move focus again when the page re-renders with a new close handler", async () => {
      const { rerender } = render(
        <Dialog title="Example Title" onClose={() => {}}>
          <button>Inside</button>
        </Dialog>,
      );
      await userEvent.tab();
      await userEvent.tab();
      expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();

      rerender(
        <Dialog title="Example Title" onClose={() => {}}>
          <button>Inside</button>
        </Dialog>,
      );

      expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    });
  });
});
