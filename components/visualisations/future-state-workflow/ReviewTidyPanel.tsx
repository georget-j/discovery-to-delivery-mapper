"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  detectFindings,
  applyReview,
  mergeFindings,
  type ReviewFinding,
  type ReviewAction,
} from "@/lib/visualisations/workflow-review";
import type { FutureStateAIWorkflowMap } from "@/lib/visualisations/workflow-types";
import type { OnboardingProject } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map: FutureStateAIWorkflowMap;
  project: OnboardingProject;
  // Receives the tidied map (decisions already applied); the orchestrator runs
  // geometric auto-layout + persist so the whole tidy is one undo step.
  onApply: (next: FutureStateAIWorkflowMap) => void;
};

const KIND_LABEL: Record<ReviewFinding["kind"], string> = {
  orphan: "Stray node",
  duplicate: "Duplicate",
  redundant: "Redundant layer",
  misplaced: "Doesn't belong",
};

const KIND_COLOR: Record<ReviewFinding["kind"], string> = {
  orphan: "bg-amber-100 text-amber-800 border-amber-200",
  duplicate: "bg-rose-100 text-rose-800 border-rose-200",
  redundant: "bg-violet-100 text-violet-800 border-violet-200",
  misplaced: "bg-orange-100 text-orange-800 border-orange-200",
};

// Action choices offered per finding kind.
function actionsFor(kind: ReviewFinding["kind"]): ReviewAction[] {
  if (kind === "duplicate" || kind === "redundant") return ["merge", "keep"];
  return ["remove", "keep"];
}

const ACTION_LABEL: Record<ReviewAction, string> = {
  merge: "Merge",
  remove: "Remove",
  keep: "Keep",
};

function aiTitle(f: {
  kind: ReviewFinding["kind"];
  nodeIds: string[];
}): string {
  if (f.kind === "duplicate")
    return `${f.nodeIds.length} nodes may do the same job`;
  if (f.kind === "redundant") return `${f.nodeIds.length} overlapping nodes`;
  return "This node may not belong here";
}

export function ReviewTidyPanel({
  open,
  onOpenChange,
  map,
  project,
  onApply,
}: Props) {
  // Rule findings are instant + deterministic.
  const ruleFindings = useMemo(() => detectFindings(map), [map]);
  const [aiFindings, setAiFindings] = useState<ReviewFinding[]>([]);
  const [askingAi, setAskingAi] = useState(false);
  const [actions, setActions] = useState<Record<string, ReviewAction>>({});

  const titleById = useMemo(
    () => new Map(map.nodes.map((n) => [n.id, n.title])),
    [map],
  );

  const findings = useMemo(
    () => mergeFindings(ruleFindings, aiFindings),
    [ruleFindings, aiFindings],
  );

  // On open, seed default actions and kick off the AI semantic pass.
  useEffect(() => {
    if (!open) return;
    setActions(
      Object.fromEntries(ruleFindings.map((f) => [f.id, f.defaultAction])),
    );
    setAiFindings([]);
    let cancelled = false;
    setAskingAi(true);
    fetch("/api/review/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.findings)) return;
        const mapped: ReviewFinding[] = data.findings.map(
          (f: {
            kind: ReviewFinding["kind"];
            nodeIds: string[];
            reason: string;
            suggestedAction: ReviewAction;
          }) => ({
            id: `ai:${f.kind}:${[...f.nodeIds].sort().join("_")}`,
            kind: f.kind,
            nodeIds: f.nodeIds,
            title: aiTitle(f),
            reason: f.reason,
            defaultAction: f.suggestedAction,
            keepId: f.nodeIds[0],
            source: "ai" as const,
          }),
        );
        setAiFindings(mapped);
        setActions((prev) => {
          const next = { ...prev };
          for (const f of mapped)
            if (!(f.id in next)) next[f.id] = f.defaultAction;
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAskingAi(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-run only when (re)opened against a given map snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, map.updatedAt]);

  const changeCount = findings.filter(
    (f) => (actions[f.id] ?? f.defaultAction) !== "keep",
  ).length;

  const apply = () => {
    const decisions = findings.map((f) => ({
      finding: f,
      action: actions[f.id] ?? f.defaultAction,
    }));
    onApply(applyReview(map, decisions));
    onOpenChange(false);
  };

  const names = (ids: string[]) =>
    ids.map((id) => `"${titleById.get(id) ?? id}"`).join(", ");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Review and tidy workflow"
      className="max-w-xl"
      dismissOnBackdrop
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="text-sm font-semibold inline-flex items-center gap-1.5">
            <span aria-hidden>🧹</span> Review &amp; tidy
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Confirm each change. Nothing is modified until you click Apply tidy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-muted/50 text-muted-foreground"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2">
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {askingAi
              ? "Checking the workflow…"
              : "Nothing to tidy — this workflow looks clean. ✨"}
          </p>
        ) : (
          findings.map((f) => {
            const current = actions[f.id] ?? f.defaultAction;
            return (
              <div key={f.id} className="rounded-md border bg-background p-2.5">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0",
                      KIND_COLOR[f.kind],
                    )}
                  >
                    {KIND_LABEL[f.kind]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug">
                      {f.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {f.reason}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1">
                      {names(f.nodeIds)}
                      {f.source === "ai" && (
                        <span className="ml-1 text-primary">· AI</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 pl-1">
                  {actionsFor(f.kind).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() =>
                        setActions((prev) => ({ ...prev, [f.id]: a }))
                      }
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded border transition-colors",
                        current === a
                          ? a === "keep"
                            ? "bg-muted text-foreground border-foreground/30"
                            : "bg-foreground text-background border-foreground"
                          : "hover:bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {ACTION_LABEL[a]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t">
        <p className="text-[11px] text-muted-foreground">
          {askingAi && "AI is still reviewing… "}
          {changeCount > 0
            ? `${changeCount} change${changeCount === 1 ? "" : "s"} selected`
            : "No changes selected"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={changeCount === 0}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            Apply tidy
          </button>
        </div>
      </div>
    </Modal>
  );
}
