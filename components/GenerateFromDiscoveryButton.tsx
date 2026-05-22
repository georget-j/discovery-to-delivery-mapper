"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Sheet } from "@/components/ui/sheet";
import { NotesDiffPanel } from "@/components/NotesDiffPanel";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  applySuggestionsToProject,
  type SuggestionRowId,
} from "@/lib/apply-suggestions";
import type { NotesExtractionResult } from "@/lib/types";

type Target = "workflows" | "systems" | "stakeholders" | "risks" | "all";

type Props = {
  target: Target;
  label?: string;
  className?: string;
};

// "✨ Generate from Discovery" CTA — POSTs the current project + target to
// /api/generate/suggestions, opens the resulting suggestions in a right
// Sheet (reusing NotesDiffPanel for cherry-pick), and merges via the
// shared apply-suggestions helper.
export function GenerateFromDiscoveryButton({
  target,
  label,
  className,
}: Props) {
  const { project, updateProject } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<NotesExtractionResult | null>(
    null,
  );
  const [open, setOpen] = useState(false);

  if (!project) return null;

  const ready = !!(
    project.customer.companyName &&
    project.customer.businessProblem &&
    project.discovery.currentProcess
  );

  const handleClick = async () => {
    if (!ready) {
      toast.info("Fill the basics in Discovery first", {
        description:
          "Need company name, business problem, and current process.",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, target }),
      });
      const data = await res.json();
      if (data.error === "no_api_key") {
        toast.error("AI suggestions need an OPENAI_API_KEY");
        return;
      }
      if (data.error) {
        toast.error("Generation failed", {
          description:
            typeof data.message === "string" ? data.message : data.error,
        });
        return;
      }
      const s = data.suggestions as NotesExtractionResult;
      const hits =
        (s.suggestedWorkflows?.length ?? 0) +
        (s.suggestedSystems?.length ?? 0) +
        (s.suggestedDataSources?.length ?? 0) +
        (s.suggestedRisks?.length ?? 0) +
        (s.suggestedStakeholders?.length ?? 0);
      if (hits === 0) {
        toast.info("No new suggestions", {
          description: "AI couldn't infer anything extra from Discovery yet.",
        });
        return;
      }
      setSuggestions(s);
      setOpen(true);
      toast.success(`Drafted ${hits} suggestion${hits !== 1 ? "s" : ""}`, {
        description: "Review and cherry-pick which to add.",
      });
    } catch (err) {
      toast.error("Network error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (selected: Set<SuggestionRowId>) => {
    if (!suggestions) return;
    const { patch, appliedLabels } = applySuggestionsToProject(
      project,
      suggestions,
      selected,
    );
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing selected");
      return;
    }
    updateProject(patch);
    setOpen(false);
    setSuggestions(null);
    toast.success(
      `Added ${appliedLabels.length} suggestion${appliedLabels.length !== 1 ? "s" : ""}`,
      { description: appliedLabels.slice(0, 3).join(" · ") },
    );
  };

  const buttonLabel = label ?? `✨ Generate from Discovery`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !ready}
        title={
          ready
            ? undefined
            : "Fill company name, business problem, and current process in Discovery first"
        }
        className={cn(
          "text-xs px-3 py-1.5 rounded-md border transition-colors font-medium",
          ready
            ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-border text-muted-foreground/60 cursor-not-allowed",
          loading && "opacity-60 cursor-wait",
          className,
        )}
      >
        {loading ? "Drafting…" : buttonLabel}
      </button>
      {suggestions && (
        <Sheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setSuggestions(null);
          }}
          side="right"
          ariaLabel="Review AI suggestions"
          className="!w-[min(32rem,90vw)] !max-w-[90vw]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="text-sm font-semibold">AI Suggestions</p>
              <p className="text-[11px] text-muted-foreground">
                Inferred from your Discovery — pick what to apply.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSuggestions(null);
              }}
              className="text-xs px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Close suggestions"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NotesDiffPanel
              suggestions={suggestions}
              project={project}
              onApply={(picked) => handleApply(picked as Set<SuggestionRowId>)}
              onCancel={() => {
                setOpen(false);
                setSuggestions(null);
              }}
            />
          </div>
        </Sheet>
      )}
    </>
  );
}
