"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Side = "left" | "right" | "bottom";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  side: Side;
  children: ReactNode;
  className?: string;
  // Used for screen readers — describes the contained panel.
  ariaLabel: string;
};

const SIDE_BASE: Record<Side, string> = {
  left: "inset-y-0 left-0 h-full w-80 max-w-[85vw] border-r",
  right: "inset-y-0 right-0 h-full w-80 max-w-[85vw] border-l",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full border-t rounded-t-xl",
};

const SIDE_HIDDEN: Record<Side, string> = {
  left: "-translate-x-full",
  right: "translate-x-full",
  bottom: "translate-y-full",
};

// Off-canvas drawer. Backdrop click + Escape close. Focus traps inside the
// panel while open and restores focus on close. Body scroll lock while open.
// SSR-safe: renders nothing until mount + open=true to avoid hydration mismatch.
export function Sheet({
  open,
  onOpenChange,
  side,
  children,
  className,
  ariaLabel,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Body scroll lock + Escape handling.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);

    // Focus the first focusable element inside the panel for keyboard users.
    requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  // Trap Tab inside the panel.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        // inert keeps the off-canvas panel's controls out of the Tab order —
        // the translate classes alone leave them focusable.
        inert={!open}
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed z-50 bg-background shadow-xl transition-transform duration-200 ease-out flex flex-col",
          SIDE_BASE[side],
          open ? "translate-x-0 translate-y-0" : SIDE_HIDDEN[side],
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
