"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Sheet } from "@/components/ui/sheet";
import { Surface } from "@/components/ui/surface";
import { NotesDiffPanel } from "@/components/NotesDiffPanel";
import { toast } from "@/lib/toast";
import {
  applySuggestionsToProject,
  type SuggestionRowId,
} from "@/lib/apply-suggestions";
import type { NotesExtractionResult } from "@/lib/types";

type Target = "workflows" | "systems" | "stakeholders" | "risks";

type Props = {
  // Which suggestion subset to surface on this tab. The banner only renders
  // when project.pendingSuggestions has at least one entry for this target.
  target: Target;
};

const TARGET_LABEL: Record<Target, string> = {
  workflows: "workflow",
  systems: "system",
  stakeholders: "stakeholder",
  risks: "risk",
};

function countForTarget(
  suggestions: NotesExtractionResult,
  target: Target,
): number {
  switch (target) {
    case "workflows":
      return suggestions.suggestedWorkflows?.length ?? 0;
    case "systems":
      return suggestions.suggestedSystems?.length ?? 0;
    case "stakeholders":
      return suggestions.suggestedStakeholders?.length ?? 0;
    case "risks":
      return suggestions.suggestedRisks?.length ?? 0;
  }
}

// Subset the suggestions to only the target's category so NotesDiffPanel
// renders just that one bucket — keeps the per-tab review focused.
function scopeToTarget(
  suggestions: NotesExtractionResult,
  target: Target,
): NotesExtractionResult {
  return {
    summary: suggestions.summary,
    suggestedWorkflows:
      target === "workflows" ? suggestions.suggestedWorkflows : undefined,
    suggestedSystems:
      target === "systems" ? suggestions.suggestedSystems : undefined,
    suggestedDataSources:
      target === "systems" ? suggestions.suggestedDataSources : undefined,
    suggestedStakeholders:
      target === "stakeholders" ? suggestions.suggestedStakeholders : undefined,
    suggestedRisks: target === "risks" ? suggestions.suggestedRisks : undefined,
  };
}

// Amber banner that appears at the top of a tab when there are pending
// AI-drafted suggestions for that target. Click → opens NotesDiffPanel
// scoped to this target. Dismiss strips the relevant subset from
// project.pendingSuggestions; full-clear when all targets are reviewed.
export function SuggestionsBanner({ target }: Props) {
  const { project, updateProject } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (!project?.pendingSuggestions) return null;
  const count = countForTarget(project.pendingSuggestions, target);
  if (count === 0) return null;

  const scoped = scopeToTarget(project.pendingSuggestions, target);

  const dismiss = () => {
    if (!project.pendingSuggestions) return;
    // Strip the relevant categories from pending.
    const next = { ...project.pendingSuggestions };
    if (target === "workflows") delete next.suggestedWorkflows;
    if (target === "systems") {
      delete next.suggestedSystems;
      delete next.suggestedDataSources;
    }
    if (target === "stakeholders") delete next.suggestedStakeholders;
    if (target === "risks") delete next.suggestedRisks;
    const remainingHits =
      (next.suggestedWorkflows?.length ?? 0) +
      (next.suggestedSystems?.length ?? 0) +
      (next.suggestedDataSources?.length ?? 0) +
      (next.suggestedRisks?.length ?? 0) +
      (next.suggestedStakeholders?.length ?? 0);
    updateProject({
      pendingSuggestions: remainingHits > 0 ? next : null,
    });
  };

  const handleApply = (selected: Set<SuggestionRowId>) => {
    if (!project.pendingSuggestions) return;
    const { patch, appliedLabels } = applySuggestionsToProject(
      project,
      scoped,
      selected,
    );
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing selected");
      return;
    }
    // Merge patch + clear this target's pending entries.
    const next = { ...project.pendingSuggestions };
    if (target === "workflows") delete next.suggestedWorkflows;
    if (target === "systems") {
      delete next.suggestedSystems;
      delete next.suggestedDataSources;
    }
    if (target === "stakeholders") delete next.suggestedStakeholders;
    if (target === "risks") delete next.suggestedRisks;
    const remainingHits =
      (next.suggestedWorkflows?.length ?? 0) +
      (next.suggestedSystems?.length ?? 0) +
      (next.suggestedDataSources?.length ?? 0) +
      (next.suggestedRisks?.length ?? 0) +
      (next.suggestedStakeholders?.length ?? 0);
    updateProject({
      ...patch,
      pendingSuggestions: remainingHits > 0 ? next : null,
    });
    setOpen(false);
    toast.success(
      `Added ${appliedLabels.length} ${TARGET_LABEL[target]} suggestion${appliedLabels.length !== 1 ? "s" : ""}`,
      { description: appliedLabels.slice(0, 3).join(" · ") },
    );
  };

  const label = TARGET_LABEL[target];

  return (
    <>
      <Surface
        variant="muted"
        className="px-4 py-2.5 flex items-center gap-3 border-amber-200 bg-amber-50/40 mb-3"
      >
        <span
          className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
          aria-hidden
        />
        <p className="text-sm flex-1">
          <span className="font-semibold">
            {count} {label} suggestion{count !== 1 ? "s" : ""}
          </span>{" "}
          ready from Discovery
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-background hover:bg-amber-100/40 transition-colors font-medium text-amber-900 shrink-0"
        >
          Review →
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss suggestions"
          title="Dismiss suggestions"
          className="text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          ✕
        </button>
      </Surface>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        ariaLabel={`Review ${label} suggestions`}
        className="!w-[min(32rem,90vw)] !max-w-[90vw]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold capitalize">
              {label} suggestions
            </p>
            <p className="text-[11px] text-muted-foreground">
              Inferred from your Discovery — pick what to apply.
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
            suggestions={scoped}
            project={project}
            onApply={(picked) => handleApply(picked as Set<SuggestionRowId>)}
            onCancel={() => setOpen(false)}
          />
        </div>
      </Sheet>
    </>
  );
}
