"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  // When true, clicking the backdrop closes the modal. Default false — pre-flight
  // and similar decisions want an explicit button click.
  dismissOnBackdrop?: boolean;
};

// Centered modal dialog with backdrop. Backdrop click optional. Escape closes.
// Focus traps inside the panel and restores focus on close. Body scroll lock.
export function Modal({
  open,
  onOpenChange,
  children,
  ariaLabel,
  className,
  dismissOnBackdrop = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);

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
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div
        aria-hidden
        onClick={() => dismissOnBackdrop && onOpenChange(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative w-full max-w-lg bg-background rounded-lg shadow-2xl border transition-transform duration-150",
          open ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.98]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
