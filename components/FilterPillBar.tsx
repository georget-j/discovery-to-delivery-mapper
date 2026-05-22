"use client";

import { cn } from "@/lib/utils";

// Single pill group within a FilterPillBar. The first option in `options` is
// treated as the "all" / unset value; selecting it deactivates this group.
export type FilterPillGroup<V extends string> = {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (next: V) => void;
};

type Props = {
  // Each group renders as a labelled row of pills. The bar is sticky so
  // it stays visible while the user scrolls through a long list.
  groups: FilterPillGroup<string>[];
  // Renders a "× Clear all" button when any group is set to a non-default
  // value. Caller wires this to reset every group to its first option.
  onClearAll: () => void;
  className?: string;
};

// Sticky filter row used on Risks + Requirements. Replaces the inline pill
// rows that used to live in each editor, gives a consistent "× Clear all"
// affordance, and keeps the active filters visible as scroll hints.
export function FilterPillBar({ groups, onClearAll, className }: Props) {
  const anyActive = groups.some((g) => g.value !== g.options[0]?.value);

  return (
    <div
      className={cn(
        "sticky top-0 z-[5] bg-background/95 backdrop-blur border-b -mx-1 px-1 pt-1 pb-2 space-y-1.5",
        className,
      )}
    >
      {groups.map((group) => (
        <div
          key={group.label}
          // On mobile, nowrap + horizontal scroll so a long filter set stays
          // out of the way of the list. Desktop wraps so all pills are visible.
          className="flex flex-nowrap md:flex-wrap items-center gap-1.5 overflow-x-auto"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold shrink-0 w-20">
            {group.label}
          </span>
          {group.options.map((opt, i) => {
            const isActive =
              group.value === opt.value ||
              (i === 0 && group.value === group.options[0].value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => group.onChange(opt.value)}
                aria-pressed={isActive}
                className={cn(
                  "shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ))}
      {anyActive && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline"
          >
            × Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
