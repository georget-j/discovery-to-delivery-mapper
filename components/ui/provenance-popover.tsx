"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// Small popover that explains WHY an auto-generated artifact appeared.
// Click the (i) icon to reveal the rationale + source refs. Used inline next
// to auto-derived risks and requirements.
type ProvenancePopoverProps = {
  rationale: string;
  className?: string;
};

export function ProvenancePopover({
  rationale,
  className,
}: ProvenancePopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="Why was this generated?"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-blue-300 bg-blue-50 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors leading-none"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 top-full left-0 mt-1.5 w-72 rounded-md border bg-popover text-popover-foreground shadow-lg p-3 text-xs leading-snug pointer-events-none space-y-1"
        >
          <span className="block font-semibold text-foreground">
            Why this was generated
          </span>
          <span className="block text-muted-foreground">{rationale}</span>
        </span>
      )}
    </span>
  );
}
