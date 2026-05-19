"use client";

import { cn } from "@/lib/utils";

export type LegendItem = {
  label: string;
  className: string; // tailwind colour class for the chip square
};

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={cn("inline-block w-3 h-3 rounded-sm border", it.className)} />
          <span className="text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
