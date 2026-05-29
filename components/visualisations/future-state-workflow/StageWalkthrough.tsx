"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PATTERN_FAMILY_COLOR } from "@/lib/patterns/future-state-patterns";
import { orderStages } from "@/lib/visualisations/stage-order";
import { stageQuestions } from "@/lib/visualisations/stage-questions";
import type { NodeProposal } from "@/lib/visualisations/node-proposals";
import type { FutureStateAIWorkflowMap } from "@/lib/visualisations/workflow-types";

type Props = {
  map: FutureStateAIWorkflowMap;
  // Called when the current stage changes — orchestrator selects + centers it.
  onFocusStage: (nodeId: string) => void;
  getProposals: (nodeId: string) => NodeProposal[];
  onApplyProposal: (
    proposal: NodeProposal,
    sourceNodeId: string | null,
  ) => void;
  onPreview: (
    proposal: NodeProposal | null,
    sourceNodeId: string | null,
  ) => void;
  askAiForNode: (nodeId: string) => Promise<NodeProposal[]>;
  // Append the user's notes for a stage to that node's description.
  onAnswer: (nodeId: string, note: string) => void;
  onClose: () => void;
};

// Guided, stage-by-stage walkthrough of the future-state map. Steps through the
// nodes in flow order; at each stage it centers the node, asks clarifying
// questions, and offers connected agent proposals ("Apply & connect" wires
// labeled data-flow edges via the shared apply path).
export function StageWalkthrough({
  map,
  onFocusStage,
  getProposals,
  onApplyProposal,
  onPreview,
  askAiForNode,
  onAnswer,
  onClose,
}: Props) {
  const stages = useMemo(() => orderStages(map), [map]);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const [aiProposals, setAiProposals] = useState<NodeProposal[]>([]);
  const [askingAi, setAskingAi] = useState(false);

  // Clamp index if the map shrank (e.g. after applying a blueprint).
  const safeIndex = Math.min(index, Math.max(0, stages.length - 1));
  const stage = stages[safeIndex];

  // Focus the canvas on the current stage; reset the per-stage transient state.
  useEffect(() => {
    if (stage) onFocusStage(stage.id);
    setNote("");
    setSavedNote(false);
    setAiProposals([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  if (!stage) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No stages to walk yet — generate or add nodes first.
      </div>
    );
  }

  const questions = stageQuestions(stage, map);
  const proposals = getProposals(stage.id);
  const allProposals = [...proposals, ...aiProposals];
  const atEnd = safeIndex >= stages.length - 1;

  const askAi = async () => {
    if (askingAi) return;
    setAskingAi(true);
    try {
      const extra = await askAiForNode(stage.id);
      const known = new Set(allProposals.map((p) => p.id));
      setAiProposals((prev) => [
        ...prev,
        ...extra.filter((p) => !known.has(p.id)),
      ]);
    } finally {
      setAskingAi(false);
    }
  };

  const saveNote = () => {
    if (!note.trim()) return;
    onAnswer(stage.id, note.trim());
    setSavedNote(true);
    setNote("");
  };

  const card = (p: NodeProposal) => {
    const src = p.preferredSourceNodeId ?? stage.id;
    return (
      <div
        key={p.id}
        onMouseEnter={() => onPreview(p, src)}
        onMouseLeave={() => onPreview(null, null)}
        className="rounded-md border bg-background p-2 space-y-1.5"
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0",
              PATTERN_FAMILY_COLOR[p.patternFamily],
            )}
          >
            {p.patternFamily.replace(/_/g, " ")}
          </span>
          <p className="text-xs font-medium leading-snug">{p.title}</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {p.rationale}
        </p>
        <button
          type="button"
          onClick={() => {
            onApplyProposal(p, src);
            onPreview(null, null);
          }}
          className="text-[11px] px-2 py-0.5 rounded bg-foreground text-background hover:bg-foreground/90 font-medium"
        >
          Apply &amp; connect
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold inline-flex items-center gap-1.5">
            <span aria-hidden>🧭</span> Walkthrough
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Stage {safeIndex + 1} of {stages.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-muted/50 text-muted-foreground shrink-0"
          aria-label="Close walkthrough"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            This stage
          </p>
          <p className="text-sm font-medium leading-snug mt-0.5">
            {stage.title}
          </p>
          {stage.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              {stage.description}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Questions to refine it
          </p>
          <ul className="space-y-1">
            {questions.map((q, i) => (
              <li key={i} className="text-[11px] leading-relaxed flex gap-1.5">
                <span aria-hidden className="text-primary">
                  ❓
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSavedNote(false);
            }}
            placeholder="Your notes for this stage…"
            rows={2}
            className="w-full text-[11px] rounded-md border px-2 py-1.5 mt-1 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveNote}
              disabled={!note.trim()}
              className="text-[11px] px-2 py-0.5 rounded border hover:bg-muted/40 disabled:opacity-50"
            >
              Save note
            </button>
            {savedNote && (
              <span className="text-[11px] text-emerald-600">Saved ✓</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-primary">
            What you could add here
          </p>
          {allProposals.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              This stage already has the usual safeguards. Try “Ask AI for
              ideas”.
            </p>
          ) : (
            allProposals.map(card)
          )}
        </div>
      </div>

      <div className="border-t p-2 space-y-2">
        <button
          type="button"
          onClick={askAi}
          disabled={askingAi}
          className="w-full text-[11px] px-2 py-1.5 rounded border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {askingAi ? "Asking AI…" : "✨ Ask AI for ideas for this stage"}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            className="flex-1 text-xs px-2 py-1.5 rounded-md border hover:bg-muted/50 disabled:opacity-40"
          >
            ← Back
          </button>
          {atEnd ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-xs px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setIndex((i) => Math.min(stages.length - 1, i + 1))
              }
              className="flex-1 text-xs px-2 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 font-medium"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
