"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Surface } from "@/components/ui/surface";
import { Sheet } from "@/components/ui/sheet";
import { NotesDiffPanel } from "@/components/NotesDiffPanel";
import {
  clearDismissedSuggestions,
  countAllSuggestions,
  mergeSuggestions,
  readDismissedSuggestions,
} from "@/components/SuggestionsBanner";
import {
  applySuggestionsToProject,
  type SuggestionRowId,
} from "@/lib/apply-suggestions";
import { toast } from "@/lib/toast";
import {
  PHASES,
  isPhaseComplete,
  phaseProgress,
  type Phase,
} from "@/lib/journey";
import { cn } from "@/lib/utils";
import type { NotesExtractionResult } from "@/lib/types";

// Hero block that visualises the 4-phase journey at a glance — each phase
// is a card showing its tabs, completion, and a CTA to open it.
export function JourneyOverview() {
  const { project } = useWorkspace();

  if (!project) return null;

  // Determine the "next" phase to continue — first incomplete phase.
  const nextPhaseId =
    PHASES.find((p) => !isPhaseComplete(project, p.id))?.id ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Customer Journey
          </h2>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
            Four phases from first call to shipped pack. The highlighted one is
            what to work on next.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {PHASES.filter((p) => isPhaseComplete(project, p.id)).length} of{" "}
          {PHASES.length} phases complete
        </p>
      </div>

      <PendingSuggestionsCard />

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

// One review-everything entry point for AI-drafted suggestions. The per-tab
// banners only surface their own subset; this card shows the full pending
// count and lets the user review all categories in a single diff panel. It
// also offers restore for banner dismissals stashed in localStorage.
function PendingSuggestionsCard() {
  const { project, updateProject } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<NotesExtractionResult | null>(
    null,
  );

  // localStorage is browser-only; read after mount to avoid hydration drift.
  useEffect(() => {
    if (!project) return;
    setDismissed(readDismissedSuggestions(project.id));
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = countAllSuggestions(project?.pendingSuggestions);
  const dismissedCount = countAllSuggestions(dismissed);
  if (!project || (pendingCount === 0 && dismissedCount === 0)) return null;

  const restoreDismissed = () => {
    if (!dismissed) return;
    const merged = project.pendingSuggestions
      ? mergeSuggestions(project.pendingSuggestions, dismissed)
      : dismissed;
    updateProject({ pendingSuggestions: merged });
    clearDismissedSuggestions(project.id);
    setDismissed(null);
    toast.success(
      `Restored ${dismissedCount} dismissed suggestion${dismissedCount !== 1 ? "s" : ""}`,
      { description: "They're back in the review queue on each tab." },
    );
  };

  const handleApply = (selected: Set<SuggestionRowId>) => {
    if (!project.pendingSuggestions) return;
    const { patch, appliedLabels } = applySuggestionsToProject(
      project,
      project.pendingSuggestions,
      selected,
    );
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing selected");
      return;
    }
    updateProject({ ...patch, pendingSuggestions: null });
    setOpen(false);
    toast.success(
      `Added ${appliedLabels.length} suggestion${appliedLabels.length !== 1 ? "s" : ""}`,
      { description: appliedLabels.slice(0, 3).join(" · ") },
    );
  };

  return (
    <>
      <Surface
        variant="muted"
        className="px-4 py-2.5 flex items-center gap-3 flex-wrap border-amber-200 bg-amber-50/40"
      >
        <span
          className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
          aria-hidden
        />
        <p className="text-sm flex-1 min-w-40">
          {pendingCount > 0 ? (
            <>
              <span className="font-semibold">
                {pendingCount} AI-drafted suggestion
                {pendingCount !== 1 ? "s" : ""}
              </span>{" "}
              waiting for review
            </>
          ) : (
            <span className="text-muted-foreground">
              Dismissed suggestions can be restored
            </span>
          )}
        </p>
        {dismissedCount > 0 && (
          <button
            type="button"
            onClick={restoreDismissed}
            className="text-xs text-amber-900 underline underline-offset-2 hover:no-underline shrink-0"
          >
            Restore {dismissedCount} dismissed
          </button>
        )}
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-background hover:bg-amber-100/40 transition-colors font-medium text-amber-900 shrink-0"
          >
            Review all suggestions ({pendingCount})
          </button>
        )}
      </Surface>
      {project.pendingSuggestions && (
        <Sheet
          open={open}
          onOpenChange={setOpen}
          side="right"
          ariaLabel="Review all AI suggestions"
          className="!w-[min(32rem,90vw)] !max-w-[90vw]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="text-sm font-semibold">All suggestions</p>
              <p className="text-[11px] text-muted-foreground">
                Everything drafted from your Discovery — pick what to apply.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Close suggestions"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NotesDiffPanel
              suggestions={project.pendingSuggestions}
              project={project}
              onApply={(picked) => handleApply(picked as Set<SuggestionRowId>)}
              onCancel={() => setOpen(false)}
            />
          </div>
        </Sheet>
      )}
    </>
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
    <Surface
      className={cn(
        "p-4 space-y-3 flex flex-col transition-all",
        isCurrent &&
          cn("ring-2 ring-offset-1", phase.color.ring, phase.color.border),
        complete && !isCurrent && "opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
              complete
                ? cn(phase.color.accent, "text-white")
                : cn(
                    phase.color.bgSubtle,
                    phase.color.text,
                    "border-2",
                    phase.color.border,
                  ),
            )}
          >
            {complete ? "✓" : phase.number}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-semibold leading-tight",
                phase.color.text,
              )}
            >
              {phase.label}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {phase.tagline}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {phase.description}
      </p>

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
                    : "border border-muted-foreground/30",
                )}
              >
                {tabComplete ? "✓" : ""}
              </span>
              <span
                className={cn(
                  tabComplete ? "text-foreground" : "text-muted-foreground",
                )}
              >
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
                : "border text-muted-foreground hover:text-foreground hover:bg-muted/50",
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
    </Surface>
  );
}

function isTabComplete(
  project: ReturnType<typeof useWorkspace>["project"],
  phaseId: string,
  tabHref: string,
): boolean {
  if (!project) return false;

  // Mirrors the more granular completion checks per tab.
  switch (`${phaseId}${tabHref}`) {
    case "discover":
      return true; // Overview is always "available", no completion gate
    case "discover/discovery":
      return (
        !!project.discovery.currentProcess && project.stakeholders.length > 0
      );
    case "design/workflow":
      return project.workflows.length > 0;
    case "design/systems":
      return project.systems.length > 0;
    case "design/requirements":
      return project.requirements.length > 0;
    case "plan/risks":
      return project.risks.length > 0;
    case "plan/pilot":
      return !!project.pilotPlan?.objective;
    case "deliver/outputs":
      return !!project.outputs?.executiveSummary;
    default:
      return false;
  }
}
