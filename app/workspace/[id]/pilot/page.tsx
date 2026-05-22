"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { PilotPlanBuilder } from "@/components/PilotPlanBuilder";
import { PageNav } from "@/components/PageNav";
import { LiveArtifactPreview } from "@/components/LiveArtifactPreview";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { PilotPlan } from "@/lib/types";

// Compact readiness strip — one row of stats. The earlier decorative 6-phase
// bar implied false precision (the other 5 phases had no real durations) and
// added vertical noise above the actual form. Stripped to the functional
// signals: sections-complete progress, duration, and per-area counts.
function PilotTimeline({ plan }: { plan: PilotPlan | null }) {
  const durationWeeks = plan?.durationWeeks ?? 8;
  const hasMetrics = (plan?.successMetrics.length ?? 0) > 0;
  const hasCriteria = (plan?.launchCriteria.length ?? 0) > 0;
  const hasUsers = (plan?.pilotUsers.length ?? 0) > 0;

  const readiness = [
    plan?.objective,
    plan?.scope,
    hasMetrics,
    hasCriteria,
    hasUsers,
  ].filter(Boolean).length;
  const pct = (readiness / 5) * 100;

  return (
    <Surface
      variant="muted"
      className="px-4 py-3 space-y-2"
      aria-label="Pilot plan readiness"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pilot Readiness
          </p>
          <span className="text-xs text-muted-foreground">
            {readiness}/5 sections
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-medium">{durationWeeks}w duration</span>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <span
            className={cn(
              hasMetrics ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {plan?.successMetrics.length ?? 0} metric
            {plan?.successMetrics.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <span
            className={cn(
              hasCriteria ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {(plan?.launchCriteria.length ?? 0) +
              (plan?.rollbackCriteria.length ?? 0)}{" "}
            launch/rollback
          </span>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <span
            className={cn(
              hasUsers ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {plan?.pilotUsers.length ?? 0} user
            {plan?.pilotUsers.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500",
            readiness === 5 ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </Surface>
  );
}

export default function PilotPage() {
  const { project, loading, updateProject } = useWorkspace();
  const saveState = useSaveIndicator(project?.updatedAt);

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  const workflowNames = project.workflows.map((w) => w.name).filter(Boolean);

  return (
    <div className="flex">
      <div className="flex-1 max-w-4xl space-y-6">
        <div className="sticky top-0 z-10 px-8 pt-8 pb-4 bg-background/95 backdrop-blur border-b flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Pilot Plan</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Lock down what success means before kick-off. Scope, users,
              metrics, and the launch/rollback gates that decide go/no-go.
            </p>
          </div>
          <SaveIndicator state={saveState} className="shrink-0 mt-1" />
        </div>

        <div className="px-8 pb-8 space-y-6">
          <PilotTimeline plan={project.pilotPlan} />

          <PilotPlanBuilder
            plan={project.pilotPlan}
            workflowNames={workflowNames}
            onChange={(pilotPlan: PilotPlan) => updateProject({ pilotPlan })}
          />

          <PageNav />
        </div>
      </div>
      <LiveArtifactPreview
        artifacts={["pilotSuccessPlan", "nextActionsChecklist"]}
      />
    </div>
  );
}
