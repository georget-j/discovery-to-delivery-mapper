"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Sheet } from "@/components/ui/sheet";
import { RecommendationCard } from "./RecommendationCard";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import { hasReadyKnowledgeBase } from "@/components/intake/useIntakeQueue";
import { retrieve } from "@/lib/kb/retrieve";
import { getChunksByIds } from "@/lib/kb/storage";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import type {
  FutureStateRecommendation,
  FutureStateRecommendationsState,
  KnowledgeBaseChunk,
  ProjectVisualisations,
} from "@/lib/types";

// Panel that sits above the future-state canvas. Generates innovative
// pattern-based recommendations grounded in the customer's workflow and
// (when available) their knowledge base, and applies them in one click.

const MIN_STEPS = 2;

export function FutureStateRecommendations() {
  const { project, updateProject } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [sourceSheetIds, setSourceSheetIds] = useState<string[] | null>(null);
  const [sourceChunks, setSourceChunks] = useState<KnowledgeBaseChunk[]>([]);

  const state: FutureStateRecommendationsState | undefined =
    project?.visualisations?.futureStateRecommendations;

  const stale = useMemo(() => {
    if (!project || !state) return false;
    return state.workflowsHashAtGeneration !== hashWorkflows(project.workflows);
  }, [project, state]);

  const generate = useCallback(async () => {
    if (!project) return;
    if (project.workflows.length < MIN_STEPS) {
      toast.info("Add a couple of workflow steps first", {
        description: "Recommendations work best with at least 2 steps.",
      });
      return;
    }
    setLoading(true);
    try {
      // KB grounding: per-step retrieval, deduped across steps.
      let kbContextChunks: { id: string; text: string; label?: string }[] = [];
      if (hasReadyKnowledgeBase(project)) {
        const queries = project.workflows
          .slice(0, 6)
          .map(
            (w) => `${w.name} — ${w.painPoints?.slice(0, 3).join(", ") ?? ""}`,
          );
        const perStep = await Promise.all(
          queries.map((q) => retrieve(project.id, q, 3).catch(() => [])),
        );
        const seen = new Set<string>();
        for (const list of perStep) {
          for (const item of list) {
            if (!seen.has(item.chunk.id)) {
              seen.add(item.chunk.id);
              kbContextChunks.push({
                id: item.chunk.id,
                text: item.chunk.text,
                label: item.label,
              });
            }
          }
        }
        // Cap at 12 to keep prompt under budget.
        kbContextChunks = kbContextChunks.slice(0, 12);
      }

      const res = await fetch("/api/recommend/future-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          workflows: project.workflows,
          kbContextChunks,
        }),
      });
      const data = await res.json();
      if (data.error === "no_api_key") {
        toast.error("OPENAI_API_KEY missing");
        return;
      }
      if (data.error || !Array.isArray(data.recommendations)) {
        toast.error("Recommendation generation failed", {
          description: data.message ?? data.error ?? "Unknown error",
        });
        return;
      }

      const previous = state ?? {
        recommendations: [],
        generatedAt: new Date(0).toISOString(),
        workflowsHashAtGeneration: "",
        dismissedIds: [],
        appliedIds: [],
      };
      // Re-key recommendation ids so a refresh after applying some doesn't
      // collide with already-applied ones.
      const fresh: FutureStateRecommendation[] = data.recommendations.map(
        (r: FutureStateRecommendation, idx: number) => ({
          ...r,
          id: `${generateId()}-${idx}`,
        }),
      );
      patchVisualisations(project, updateProject, {
        recommendations: fresh,
        generatedAt: new Date().toISOString(),
        workflowsHashAtGeneration: hashWorkflows(project.workflows),
        dismissedIds: [], // wipe dismissals on refresh — IDs no longer match
        appliedIds: previous.appliedIds.filter((id) =>
          fresh.some((r) => r.id === id),
        ),
      });
      toast.success(
        `Drafted ${fresh.length} recommendation${fresh.length !== 1 ? "s" : ""}`,
        { description: "Review and apply per step." },
      );
    } catch (err) {
      toast.error("Recommendation generation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [project, state, updateProject]);

  const applyRecommendation = useCallback(
    (rec: FutureStateRecommendation) => {
      if (!project) return;
      const nextWorkflows = [...project.workflows];

      if (rec.stepId) {
        const idx = nextWorkflows.findIndex((s) => s.id === rec.stepId);
        if (idx < 0) {
          toast.error("Couldn't find that step", {
            description:
              "Maybe it was renamed or deleted. Refresh to re-draft.",
          });
          return;
        }
        const existing = nextWorkflows[idx];
        nextWorkflows[idx] = {
          ...existing,
          futureState: rec.apply.futureState,
          description: existing.description
            ? `${existing.description}\n\nFuture state: ${rec.apply.futureStateDescription}`
            : rec.apply.futureStateDescription,
        };
      } else if (nextWorkflows.length > 0) {
        // Workflow-level — prepend to first step's description with a marker.
        const first = nextWorkflows[0];
        nextWorkflows[0] = {
          ...first,
          description:
            `# Workflow-level proposal\n${rec.apply.futureStateDescription}\n\n${first.description}`.trim(),
        };
      }

      updateProject({ workflows: nextWorkflows });

      // Mark applied.
      const nextApplied = Array.from(
        new Set([...(state?.appliedIds ?? []), rec.id]),
      );
      patchVisualisations(project, updateProject, {
        ...(state ?? defaultState()),
        appliedIds: nextApplied,
      });

      toast.success("Applied", {
        description: rec.stepId
          ? `Step "${nextWorkflows.find((s) => s.id === rec.stepId)?.name ?? ""}" updated.`
          : "Workflow-level proposal added to step 1.",
      });

      // If the rec introduces risks, surface a follow-up toast prompt.
      if (rec.risks.length > 0) {
        toast.info("This pattern introduces risks", {
          description: `Consider adding to Risks tab: ${rec.risks.slice(0, 2).join(" · ")}`,
        });
      }
    },
    [project, state, updateProject],
  );

  const dismiss = useCallback(
    (recId: string) => {
      if (!project) return;
      const current = state ?? defaultState();
      patchVisualisations(project, updateProject, {
        ...current,
        dismissedIds: Array.from(new Set([...current.dismissedIds, recId])),
      });
    },
    [project, state, updateProject],
  );

  const restoreDismissed = useCallback(() => {
    if (!project) return;
    const current = state ?? defaultState();
    patchVisualisations(project, updateProject, {
      ...current,
      dismissedIds: [],
    });
  }, [project, state, updateProject]);

  const showSources = useCallback(async (chunkIds: string[]) => {
    setSourceSheetIds(chunkIds);
    try {
      const chunks = await getChunksByIds(chunkIds);
      setSourceChunks(chunks);
    } catch {
      setSourceChunks([]);
    }
  }, []);

  useEffect(() => {
    if (sourceSheetIds === null) setSourceChunks([]);
  }, [sourceSheetIds]);

  if (!project) return null;
  if (project.workflows.length < MIN_STEPS) {
    return (
      <div className="rounded-md border bg-muted/10 p-4 text-sm text-muted-foreground">
        Add at least 2 workflow steps to draft innovation recommendations.
      </div>
    );
  }

  const visible = (state?.recommendations ?? []).filter(
    (r) => !state?.dismissedIds.includes(r.id),
  );
  const dismissedCount = state?.dismissedIds.length ?? 0;

  return (
    <div className="rounded-md border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span aria-hidden>✨</span> Innovation Recommendations
            {stale && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                Stale
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pattern-grounded modernizations for your workflow. Apply per step.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className={cn(
            "text-xs px-3 py-1.5 rounded border font-medium",
            loading
              ? "opacity-60 cursor-wait"
              : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
          )}
        >
          {loading
            ? "Drafting…"
            : state
              ? stale
                ? "Refresh"
                : "Re-draft"
              : "Generate"}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {state
            ? "All recommendations dismissed."
            : "Click Generate to draft recommendations."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((rec) => (
            <li key={rec.id}>
              <RecommendationCard
                rec={rec}
                step={
                  rec.stepId
                    ? project.workflows.find((s) => s.id === rec.stepId)
                    : undefined
                }
                applied={!!state?.appliedIds.includes(rec.id)}
                onApply={applyRecommendation}
                onDismiss={dismiss}
                onShowSources={showSources}
              />
            </li>
          ))}
        </ul>
      )}

      {dismissedCount > 0 && (
        <button
          type="button"
          onClick={restoreDismissed}
          className="text-xs text-muted-foreground hover:underline"
        >
          + Restore dismissed ({dismissedCount})
        </button>
      )}

      <Sheet
        open={sourceSheetIds !== null}
        onOpenChange={(o) => {
          if (!o) setSourceSheetIds(null);
        }}
        side="right"
        ariaLabel="Source chunks"
        className="!w-[min(28rem,90vw)]"
      >
        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">Source chunks</p>
            <p className="text-[11px] text-muted-foreground">
              KB excerpts cited in the recommendation rationale.
            </p>
          </div>
          {sourceChunks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No chunks available (likely cleared from storage).
            </p>
          ) : (
            <ul className="space-y-3">
              {sourceChunks.map((c) => (
                <li
                  key={c.id}
                  className="text-xs bg-muted/30 rounded p-2 border"
                >
                  <p className="font-mono text-[10px] text-muted-foreground mb-1">
                    {c.id}
                    {c.page !== undefined ? ` · p.${c.page}` : ""}
                    {c.sheet ? ` · ${c.sheet}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {c.text.slice(0, 600)}
                    {c.text.length > 600 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function defaultState(): FutureStateRecommendationsState {
  return {
    recommendations: [],
    generatedAt: new Date(0).toISOString(),
    workflowsHashAtGeneration: "",
    dismissedIds: [],
    appliedIds: [],
  };
}

function patchVisualisations(
  project: NonNullable<ReturnType<typeof useWorkspace>["project"]>,
  updateProject: ReturnType<typeof useWorkspace>["updateProject"],
  nextState: FutureStateRecommendationsState,
) {
  const visualisations: ProjectVisualisations = {
    ...(project.visualisations ?? {}),
    futureStateRecommendations: nextState,
  };
  updateProject({ visualisations });
}
