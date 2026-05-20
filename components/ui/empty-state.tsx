import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  // One-character emoji or short symbol. Decorative — has aria-hidden.
  icon?: string;
  // Short headline. Required.
  title: string;
  // Optional one- or two-line body explaining what to do next.
  body?: ReactNode;
  // Optional CTA element — typically a <Button> or anchor.
  cta?: ReactNode;
  // Visual weight: "subtle" (most editors) or "prominent" (full-page empty states).
  tone?: "subtle" | "prominent";
  className?: string;
};

// Standard empty-state block. Use anywhere a list/canvas/grid has nothing to
// show yet. Replaces ad-hoc "<div class='border-dashed…'>" patterns scattered
// across editors. Keep copy concise: the title says what's missing, the body
// says how to fix it, the CTA is the fix.
export function EmptyState({ icon, title, body, cta, tone = "subtle", className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed flex flex-col items-center text-center gap-2",
        tone === "subtle"
          ? "px-6 py-10 bg-background"
          : "px-8 py-14 bg-muted/20",
        className,
      )}
    >
      {icon && (
        <span aria-hidden className={tone === "prominent" ? "text-4xl" : "text-2xl"}>
          {icon}
        </span>
      )}
      <p className={cn("font-semibold", tone === "prominent" ? "text-base" : "text-sm")}>
        {title}
      </p>
      {body && (
        <div className="text-xs text-muted-foreground leading-relaxed max-w-md">
          {body}
        </div>
      )}
      {cta && <div className="pt-2">{cta}</div>}
    </div>
  );
}
