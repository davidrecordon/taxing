"use client";

import { ReactNode, useId, useRef } from "react";
import { useDialogKeyboard } from "./useDialogKeyboard";

interface Props {
  title: string;
  onClose: () => void;
  size?: keyof typeof SIZE_CLASSES;
  children: ReactNode;
}

const SIZE_CLASSES = {
  medium: "sm:max-w-2xl",
  large: "sm:max-w-4xl",
};

/**
 * Modal dialog shell: backdrop, title with a close button, content, and a
 * Close button in the footer. Render it only while the dialog is open.
 */
export default function Dialog({
  title,
  onClose,
  size = "medium",
  children,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard(onClose, dialogRef, closeButtonRef);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative bg-background rounded-[var(--radius-lg)] max-w-full ${SIZE_CLASSES[size]} w-full animate-scale-in`}
        >
          {/* The card is translucent in the dark theme, so it sits on an
              opaque layer to keep the page from showing through */}
          <div className="theme-card p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2
                id={titleId}
                className="text-xl font-semibold text-text-primary font-display"
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {children}

            {/* Footer */}
            <div className="mt-4 flex justify-end">
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="px-4 py-2 text-text-secondary border border-border rounded-[var(--radius-md)] hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
