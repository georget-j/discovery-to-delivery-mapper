"use client";

import { cn } from "@/lib/utils";

type Props = {
  n: number;
  onClick?: () => void;
};

// Inline numbered citation chip rendered inside artifact markdown.
// Maps to a footnote in the same artifact OR to a row in the Sources panel.
// Click flashes the Sources panel (handled by parent via onClick).
export function SourceChip({ n, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center align-baseline",
        "h-4 min-w-4 px-1 mx-0.5 rounded text-[10px] font-semibold leading-none",
        "bg-primary/10 text-primary border border-primary/20",
        "hover:bg-primary/20 hover:border-primary/40 transition-colors",
      )}
      title={`Source ${n} — see the Sources panel`}
      aria-label={`Source ${n}`}
    >
      {n}
    </button>
  );
}
