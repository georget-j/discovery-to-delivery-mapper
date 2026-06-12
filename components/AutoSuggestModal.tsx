"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { toast } from "@/lib/toast";
import { isPhaseComplete } from "@/lib/journey";
import type { NotesExtractionResult } from "@/lib/types";

// Non-blocking offer shown while Discovery is complete, the user has never
// been offered suggestions, and none are pending. Replaces the old one-shot
// modal: it never steals focus mid-typing, and declining only hides this
// offer — the "Draft suggestions" buttons on the Workflow/Systems/Risks tabs
// remain available. Export name kept so the workspace layout mount is
// unchanged. Accepting kicks off a single AI call for the "all" target; the
// response is stored on project.pendingSuggestions and surfaced via banners
// in each downstream tab.
export function AutoSuggestModal() {
  const { project, updateProject } = useWorkspace();
  const [loading, setLoading] = useState(false);

  if (!project) return null;
  if (
    !isPhaseComplete(project, "discover") ||
    project.suggestionsOfferedAt ||
    project.pendingSuggestions
  )
    return null;

  const decline = () => {
    updateProject({ suggestionsOfferedAt: new Date().toISOString() });
  };

  const accept = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, target: "all" }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error("Couldn't draft suggestions", {
          description:
            typeof data.message === "string" ? data.message : data.error,
        });
        updateProject({ suggestionsOfferedAt: new Date().toISOString() });
        return;
      }
      const suggestions = data.suggestions as NotesExtractionResult;
      const hits =
        (suggestions.suggestedWorkflows?.length ?? 0) +
        (suggestions.suggestedSystems?.length ?? 0) +
        (suggestions.suggestedDataSources?.length ?? 0) +
        (suggestions.suggestedRisks?.length ?? 0) +
        (suggestions.suggestedStakeholders?.length ?? 0);
      updateProject({
        pendingSuggestions: suggestions,
        suggestionsOfferedAt: new Date().toISOString(),
      });
      toast.success(`Drafted ${hits} suggestion${hits !== 1 ? "s" : ""}`, {
        description: "Each downstream tab now shows a review banner.",
      });
    } catch (err) {
      toast.error("Network error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      updateProject({ suggestionsOfferedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-amber-200 bg-amber-50 shadow-lg px-4 py-3 flex items-start gap-3"
    >
      <span
        className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Discovery complete</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Want me to draft typical workflows, systems, stakeholders, and risks
          from what you&apos;ve filled in? You&apos;ll review each suggestion
          before it lands.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={accept}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium disabled:opacity-60"
          >
            {loading ? "Drafting…" : "Yes, draft suggestions"}
          </button>
          <button
            type="button"
            onClick={decline}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-background hover:bg-amber-100/40 transition-colors disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={decline}
        disabled={loading}
        aria-label="Dismiss suggestion offer"
        title="Dismiss — you can still draft suggestions from each tab"
        className="text-xs text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-60"
      >
        ✕
      </button>
    </div>
  );
}
