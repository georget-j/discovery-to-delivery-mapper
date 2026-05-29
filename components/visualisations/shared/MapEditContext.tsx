"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { NodeProposal } from "@/lib/visualisations/node-proposals";

// Lightweight context exposed by canvases so node renderers can patch their own
// data directly (e.g. inline-edit a title) and surface a hover toolbar without
// prop-drilling action callbacks through React Flow.

export type ProposalPreview = {
  proposal: NodeProposal;
  sourceNodeId: string | null;
} | null;

type Ctx = {
  patchNode: (id: string, patch: Record<string, unknown>) => void;
  // Optional node-toolbar actions. Provided by the future-state orchestrator;
  // omitted on canvases that don't support them (the toolbar hides the action).
  duplicateNode?: (id: string) => void;
  deleteNode?: (id: string) => void;
  convertToRequirement?: (id: string) => void;
  // Opens the contextual proposal popover anchored to this node (Pass 6 B4).
  proposeForNode?: (id: string) => void;
  // Current-state only: jump to the future-state tab to design the AI version.
  jumpToFuture?: (id: string) => void;
  // ── Proposal flow (future-state) ──────────────────────────────────────────
  // Deterministic proposals for a node (instant, from node-proposals.ts).
  getProposals?: (nodeId: string) => NodeProposal[];
  // Apply a proposal: insert its nodes/edges and persist.
  applyProposal?: (proposal: NodeProposal, sourceNodeId: string | null) => void;
  // Set/clear the translucent ghost preview rendered on the canvas.
  setPreview?: (preview: ProposalPreview) => void;
  // Ask the AI for richer, project-specific proposals for a node.
  askAiForNode?: (nodeId: string) => Promise<NodeProposal[]>;
};

const MapEditContext = createContext<Ctx | null>(null);

export function MapEditProvider({
  value,
  children,
}: {
  value: Ctx;
  children: ReactNode;
}) {
  return (
    <MapEditContext.Provider value={value}>{children}</MapEditContext.Provider>
  );
}

export function useMapEdit(): Ctx {
  const ctx = useContext(MapEditContext);
  if (!ctx) {
    // Permissive no-op for SSR / tests; production paths always provide a value.
    return { patchNode: () => {} };
  }
  return ctx;
}
