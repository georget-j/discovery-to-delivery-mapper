"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { Surface } from "@/components/ui/surface";
import { phaseProgress } from "@/lib/journey";
import { cn } from "@/lib/utils";

// Slim progress strip shown above the Discovery form. Discovery is the gate
// for downstream artifacts so the user benefits from explicit "you're X% done"
// feedback. Reads phaseProgress for the discover phase + counts a few quick
// signals that complement the progress (#stakeholders, #regulatory tags).
export function DiscoveryCompletenessStrip() {
  const { project } = useWorkspace();
  if (!project) return null;

  const { done, total } = phaseProgress(project, "discover");
  const pct = Math.round((done / total) * 100);
  const isComplete = done === total;

  const stakeholderCount = project.stakeholders.length;
  const regulatoryCount = project.customer.regulatoryContext.length;

  return (
    <Surface className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              isComplete ? "text-emerald-700" : "text-blue-700",
            )}
          >
            {isComplete ? "✓ Discovery complete" : "Discovery progress"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {done}/{total} required · {stakeholderCount} stakeholder
            {stakeholderCount !== 1 ? "s" : ""}
            {regulatoryCount > 0 &&
              ` · ${regulatoryCount} regulatory tag${regulatoryCount !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isComplete ? "bg-emerald-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </div>
      {!isComplete && (
        <p className="text-[11px] text-muted-foreground/80 sm:max-w-xs">
          {done === 0
            ? "Start with the current process and add at least one stakeholder."
            : "One more step and Design unlocks."}
        </p>
      )}
    </Surface>
  );
}
