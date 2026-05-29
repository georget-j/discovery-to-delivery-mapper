"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PATTERN_FAMILY_COLOR } from "@/lib/patterns/future-state-patterns";
import {
  proposeForMap,
  type NodeProposal,
} from "@/lib/visualisations/node-proposals";
import type { FutureStateAIWorkflowMap } from "@/lib/visualisations/workflow-types";
import type { OnboardingProject } from "@/lib/types";

type Props = {
  map: FutureStateAIWorkflowMap;
  project: OnboardingProject;
  onApply: (proposal: NodeProposal, sourceNodeId: string | null) => void;
  onPreview: (
    proposal: NodeProposal | null,
    sourceNodeId: string | null,
  ) => void;
  onAskAi: () => Promise<NodeProposal[]>;
};

// Persistent "Suggestions" rail listing every proposal for the whole map,
// grouped by node, with map-level gaps surfaced first. Hovering a card
// previews the would-be node(s) as a ghost on the canvas; Apply commits.
export function ProposalRail({
  map,
  project,
  onApply,
  onPreview,
  onAskAi,
}: Props) {
  const groups = useMemo(() => proposeForMap(map, project), [map, project]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [aiProposals, setAiProposals] = useState<NodeProposal[]>([]);
  const [askingAi, setAskingAi] = useState(false);

  const visible = groups.map((g) => ({
    ...g,
    proposals: g.proposals.filter((p) => !dismissed.has(p.id)),
  }));

  // Whole-workflow blueprints (scope "workflow") headline the rail under
  // "Transform the workflow"; the smaller per-node adds group beneath.
  const blueprints: { proposal: NodeProposal; sourceNodeId: string | null }[] =
    [];
  visible.forEach((g) =>
    g.proposals
      .filter((p) => p.scope === "workflow")
      .forEach((p) => blueprints.push({ proposal: p, sourceNodeId: g.nodeId })),
  );
  const nodeGroups = visible
    .map((g) => ({
      ...g,
      proposals: g.proposals.filter((p) => p.scope !== "workflow"),
    }))
    .filter((g) => g.proposals.length > 0);

  const aiVisible = aiProposals.filter((p) => !dismissed.has(p.id));
  const total =
    blueprints.length +
    nodeGroups.reduce((s, g) => s + g.proposals.length, 0) +
    aiVisible.length;

  const askAi = async () => {
    if (askingAi) return;
    setAskingAi(true);
    try {
      const extra = await onAskAi();
      const known = new Set(aiProposals.map((p) => p.id));
      setAiProposals((prev) => [
        ...prev,
        ...extra.filter((p) => !known.has(p.id)),
      ]);
    } finally {
      setAskingAi(false);
    }
  };

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  const card = (p: NodeProposal, sourceNodeId: string | null) => (
    <div
      key={p.id}
      onMouseEnter={() => onPreview(p, sourceNodeId)}
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onApply(p, sourceNodeId)}
          className="text-[11px] px-2 py-0.5 rounded bg-foreground text-background hover:bg-foreground/90 font-medium"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => dismiss(p.id)}
          className="text-[11px] px-2 py-0.5 rounded border hover:bg-muted/40 text-muted-foreground"
        >
          Dismiss
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b">
        <p className="text-sm font-semibold inline-flex items-center gap-1.5">
          <span aria-hidden>✨</span> Suggestions
          {total > 0 && (
            <span className="text-[11px] font-normal text-muted-foreground">
              ({total})
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Ways to make this workflow production-ready. Hover to preview, Apply
          to add.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-4 text-center">
            This map already has the usual AI safeguards in place. Try “Ask AI
            for ideas” for tailored suggestions.
          </p>
        ) : (
          <>
            {blueprints.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary px-1">
                  Transform the workflow
                </p>
                {blueprints.map((b) => card(b.proposal, b.sourceNodeId))}
              </div>
            )}
            {nodeGroups.map((g) => (
              <div key={g.nodeId ?? "map"} className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-1">
                  {g.nodeTitle ?? "Smaller adds"}
                </p>
                {g.proposals.map((p) => card(p, g.nodeId))}
              </div>
            ))}
            {aiVisible.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary px-1">
                  AI ideas
                </p>
                {aiVisible.map((p) => card(p, null))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t p-2">
        <button
          type="button"
          onClick={askAi}
          disabled={askingAi}
          className="w-full text-[11px] px-2 py-1.5 rounded border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {askingAi ? "Asking AI…" : "✨ Ask AI for ideas"}
        </button>
      </div>
    </div>
  );
}
