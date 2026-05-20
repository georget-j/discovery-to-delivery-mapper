"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { PilotPlanBuilder } from "@/components/PilotPlanBuilder";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { cn } from "@/lib/utils";
import type { PilotPlan } from "@/lib/types";

const PHASES = [
  { label: "Discovery", short: "Discovery" },
  { label: "Integration", short: "Integration" },
  { label: "Pilot Prep", short: "Pilot Prep" },
  { label: "Pilot", short: "Pilot" },
  { label: "Review", short: "Review" },
  { label: "Rollout", short: "Rollout" },
] as const;

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

  return (
    <div className="rounded-lg border bg-muted/20 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pilot Timeline
        </p>
        <span className="text-xs text-muted-foreground">
          {readiness}/5 sections complete
        </span>
      </div>

      <div className="flex items-stretch gap-0">
        {PHASES.map((phase, i) => {
          const isPilot = phase.label === "Pilot";
          return (
            <div key={phase.label} className="flex-1 flex flex-col gap-1">
              <div
                className={cn(
                  "h-6 flex items-center justify-center text-xs font-medium rounded-sm mx-0.5 transition-colors",
                  isPilot
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <span className="hidden sm:inline">{phase.short}</span>
                <span className="sm:hidden">{i + 1}</span>
              </div>
              {isPilot && (
                <p className="text-center text-xs text-muted-foreground">
                  {durationWeeks}w
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span
          className={cn(
            hasMetrics ? "text-green-700" : "text-muted-foreground",
          )}
        >
          {plan?.successMetrics.length ?? 0} success metric
          {plan?.successMetrics.length !== 1 ? "s" : ""}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span
          className={cn(
            hasCriteria ? "text-green-700" : "text-muted-foreground",
          )}
        >
          {(plan?.launchCriteria.length ?? 0) +
            (plan?.rollbackCriteria.length ?? 0)}{" "}
          launch/rollback criteria
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span
          className={cn(hasUsers ? "text-green-700" : "text-muted-foreground")}
        >
          {plan?.pilotUsers.length ?? 0} pilot user
          {plan?.pilotUsers.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
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
    <div className="max-w-4xl space-y-6">
      <div className="sticky top-0 z-10 px-8 pt-8 pb-4 bg-background/95 backdrop-blur border-b flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Pilot Plan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lock down what success means before kick-off. Scope, users, metrics,
            and the launch/rollback gates that decide go/no-go.
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
  );
}
