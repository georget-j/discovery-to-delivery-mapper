"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// Tiny CSS-only popover for taxonomy hints. Opens on click + hover; closes on
// outside click, Escape, or losing focus. No Radix dep — the app already has
// the Sheet primitive for heavier overlays. Use for one-or-two-sentence
// explanations of select-option taxonomies (stakeholder involvement,
// sensitivity, complexity, etc).
type InfoTipProps = {
  label: string;
  items: { term: string; hint: string }[];
  className?: string;
};

export function InfoTip({ label, items, className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        aria-label={`What does ${label} mean?`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/30 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors leading-none"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 top-full left-0 mt-1.5 w-64 rounded-md border bg-popover text-popover-foreground shadow-lg p-3 text-xs space-y-1.5 pointer-events-none"
        >
          <span className="block font-semibold text-foreground">{label}</span>
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.term} className="leading-snug">
                <span className="font-medium text-foreground">{it.term}</span>
                <span className="text-muted-foreground"> — {it.hint}</span>
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
