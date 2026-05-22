import * as React from "react";
import { cn } from "@/lib/utils";

// Lightweight card shell — replaces the 22+ inline `rounded-lg border
// bg-background` patterns scattered through editor rows, dashboard tiles, and
// list backgrounds. The richer <Card> shadcn primitive (with header/footer
// slots and ring + rounded-xl styling) remains for elaborate compositions
// like ScenarioCard.
//
// Variants:
//   default     — border + bg-background (the most common pattern)
//   muted       — border + bg-muted/20 (for tiles inside busier panels)
//   interactive — adds hover shadow + cursor-pointer feel for clickable tiles

type Variant = "default" | "muted" | "interactive";

const VARIANT_CLASS: Record<Variant, string> = {
  default: "border bg-background",
  muted: "border bg-muted/20",
  interactive:
    "border bg-background hover:shadow-sm hover:border-foreground/15 transition-all cursor-pointer",
};

export function Surface({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: Variant }) {
  return (
    <div
      data-slot="surface"
      data-variant={variant}
      className={cn("rounded-lg", VARIANT_CLASS[variant], className)}
      {...props}
    />
  );
}
