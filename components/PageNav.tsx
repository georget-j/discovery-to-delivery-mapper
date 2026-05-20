"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { getPrevNext } from "@/lib/journey";
import { cn } from "@/lib/utils";

// One-line rationale per destination tab href — answers "why am I going here?".
// Keys match Tab.href from lib/journey.ts (empty string === Overview).
const WHY_NEXT: Record<string, string> = {
  "": "Track open actions and see the journey at a glance.",
  "/discovery": "Capture the customer profile and stakeholders.",
  "/workflow":
    "Map the current process so we can identify automation opportunities.",
  "/systems": "List every tool the AI touches and every dataset it ingests.",
  "/requirements": "Lock down what must be true before integration starts.",
  "/risks": "Surface what could derail the pilot, with mitigations.",
  "/pilot": "Define what 'pilot success' looks like before kick-off.",
  "/outputs": "Generate and ship the 15-artifact deployment pack.",
};

export function PageNav() {
  const pathname = usePathname();
  const { project } = useWorkspace();

  if (!project) return null;

  const { prev, next } = getPrevNext(pathname, project.id);
  const whyNext = next ? WHY_NEXT[next.tab.href] : undefined;

  return (
    <div className="border-t pt-6 mt-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      {prev ? (
        <Link
          href={`/workspace/${project.id}${prev.tab.href}`}
          className="group flex items-center gap-3 px-4 py-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors min-w-0 w-full sm:flex-1 sm:max-w-xs"
        >
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            ←
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-[10px] uppercase tracking-wider font-semibold",
                prev.phase.color.text,
              )}
            >
              {prev.phase.label} · Previous
            </p>
            <p className="text-sm font-medium truncate">{prev.tab.label}</p>
          </div>
        </Link>
      ) : (
        <div className="hidden sm:block sm:flex-1 sm:max-w-xs" />
      )}

      {next ? (
        <Link
          href={`/workspace/${project.id}${next.tab.href}`}
          className={cn(
            "group flex items-start gap-3 px-4 py-3 rounded-lg border bg-background hover:shadow-sm transition-all min-w-0 w-full sm:flex-1 sm:max-w-sm sm:ml-auto sm:justify-end",
            next.phase.color.border,
          )}
        >
          <div className="min-w-0 flex-1 sm:flex-initial sm:text-right">
            <p
              className={cn(
                "text-[10px] uppercase tracking-wider font-semibold",
                next.phase.color.text,
              )}
            >
              {next.phase.label} · Next
            </p>
            <p className="text-sm font-medium truncate">{next.tab.label}</p>
            {whyNext && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                {whyNext}
              </p>
            )}
          </div>
          <span
            className={cn(
              "transition-colors mt-0.5 shrink-0",
              next.phase.color.text,
            )}
          >
            →
          </span>
        </Link>
      ) : (
        <div className="hidden sm:block sm:flex-1 sm:max-w-xs sm:ml-auto" />
      )}
    </div>
  );
}
