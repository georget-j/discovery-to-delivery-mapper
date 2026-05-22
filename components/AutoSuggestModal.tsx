"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import { isPhaseComplete } from "@/lib/journey";
import type { NotesExtractionResult } from "@/lib/types";

// One-shot modal that fires when Discovery transitions to fully complete
// AND the user has never been offered suggestions for this project.
// Accepting kicks off a single AI call for the "all" target; the response
// is stored on project.pendingSuggestions and surfaced via banners in
// each downstream tab.
export function AutoSuggestModal() {
  const { project, updateProject } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Track previous completion state so we can detect the false→true edge.
  const wasComplete = useRef<boolean | null>(null);

  useEffect(() => {
    if (!project) return;
    const complete = isPhaseComplete(project, "discover");
    const previously = wasComplete.current;
    wasComplete.current = complete;

    // Only fire on the transition, not on every render. Also skip when
    // the user has already been offered (suggestionsOfferedAt set) or
    // when pending suggestions already exist.
    if (
      previously === false &&
      complete &&
      !project.suggestionsOfferedAt &&
      !project.pendingSuggestions
    ) {
      setOpen(true);
    }
  }, [project]);

  if (!project) return null;

  const decline = () => {
    updateProject({ suggestionsOfferedAt: new Date().toISOString() });
    setOpen(false);
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
        setOpen(false);
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
      setOpen(false);
    } catch (err) {
      toast.error("Network error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      updateProject({ suggestionsOfferedAt: new Date().toISOString() });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) decline();
        setOpen(next);
      }}
      ariaLabel="Draft suggestions from Discovery?"
    >
      <div className="p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold">Discovery complete</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Want me to draft typical workflows, systems, stakeholders, and risks
            from what you've filled in? You'll review each suggestion before it
            lands.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={decline}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            I'll do it manually
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium disabled:opacity-60"
          >
            {loading ? "Drafting…" : "Yes, draft suggestions"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
