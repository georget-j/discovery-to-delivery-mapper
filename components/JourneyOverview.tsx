"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PHASES, isPhaseComplete, phaseProgress, type Phase } from "@/lib/journey";
import { cn } from "@/lib/utils";

// Hero block that visualises the 4-phase journey at a glance — each phase
// is a card showing its tabs, completion, and a CTA to open it.
export function JourneyOverview() {
  const { project } = useWorkspace();

  if (!project) return null;

  // Determine the "next" phase to continue — first incomplete phase.
  const nextPhaseId = PHASES.find((p) => !isPhaseComplete(project, p.id))?.id ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Customer Journey
        </h2>
        <p className="text-xs text-muted-foreground">
          {PHASES.filter((p) => isPhaseComplete(project, p.id)).length} of {PHASES.length} phases complete
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {PHASES.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            projectId={project.id}
            isCurrent={phase.id === nextPhaseId}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
  projectId,
  isCurrent,
}: {
  phase: Phase;
  projectId: string;
  isCurrent: boolean;
}) {
  const { project } = useWorkspace();
  const complete = isPhaseComplete(project, phase.id);
  const progress = phaseProgress(project, phase.id);
  const firstTabHref = `/workspace/${projectId}${phase.tabs[0].href}`;

  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-4 space-y-3 flex flex-col transition-all",
        isCurrent && cn("ring-2 ring-offset-1", phase.color.ring, phase.color.border),
        complete && !isCurrent && "opacity-90"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
              complete
                ? cn(phase.color.accent, "text-white")
                : cn(phase.color.bgSubtle, phase.color.text, "border-2", phase.color.border)
            )}
          >
            {complete ? "✓" : phase.number}
          </span>
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold leading-tight", phase.color.text)}>
              {phase.label}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">{phase.tagline}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{phase.description}</p>

      <div className="space-y-1 flex-1">
        {phase.tabs.map((tab) => {
          const tabComplete = isTabComplete(project, phase.id, tab.href);
          return (
            <div key={tab.href} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "w-3 h-3 rounded-full shrink-0 flex items-center justify-center text-[8px]",
                  tabComplete
                    ? cn(phase.color.accent, "text-white")
                    : "border border-muted-foreground/30"
                )}
              >
                {tabComplete ? "✓" : ""}
              </span>
              <span className={cn(tabComplete ? "text-foreground" : "text-muted-foreground")}>
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t">
        <Link
          href={firstTabHref}
          className={cn(
            "block text-center text-xs font-medium py-1.5 rounded-md transition-colors",
            isCurrent
              ? cn(phase.color.accent, "text-white hover:opacity-90")
              : complete
                ? cn(phase.color.bgSubtle, phase.color.text, "hover:opacity-90")
                : "border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {isCurrent ? "Continue →" : complete ? "Review" : "Open"}
        </Link>
        {progress.total > 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            {progress.done}/{progress.total} steps complete
          </p>
        )}
      </div>
    </div>
  );
}

function isTabComplete(project: ReturnType<typeof useWorkspace>["project"], phaseId: string, tabHref: string): boolean {
  if (!project) return false;

  // Mirrors the more granular completion checks per tab.
  switch (`${phaseId}${tabHref}`) {
    case "discover":               return true; // Overview is always "available", no completion gate
    case "discover/discovery":     return !!project.discovery.currentProcess && project.stakeholders.length > 0;
    case "design/workflow":        return project.workflows.length > 0;
    case "design/systems":         return project.systems.length > 0;
    case "design/requirements":    return project.requirements.length > 0;
    case "plan/risks":             return project.risks.length > 0;
    case "plan/pilot":             return !!project.pilotPlan?.objective;
    case "deliver/outputs":        return !!project.outputs?.executiveSummary;
    default:                       return false;
  }
}
