"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { VisualisationFrame } from "../shared/VisualisationFrame";
import { StaleBanner } from "../shared/StaleBanner";
import { SourceBadge } from "../shared/SourceBadge";
import { downloadText } from "../shared/export-helpers";
import {
  CanvasContextMenu,
  type ContextMenuItem,
} from "../shared/CanvasContextMenu";
import { useUndoRedo } from "../shared/useUndoRedo";
import { useCanvasShortcuts } from "../shared/useCanvasShortcuts";
import { FutureWorkflowCanvas } from "./FutureWorkflowCanvas";
import { FutureWorkflowInspectorPanel } from "./FutureWorkflowInspectorPanel";
import { FutureWorkflowToolbar } from "./FutureWorkflowToolbar";
import { FutureWorkflowLegend } from "./FutureWorkflowLegend";
import { CurrentFutureComparisonPanel } from "./CurrentFutureComparisonPanel";
import {
  newBlankFutureNode,
  FUTURE_LANE_Y,
  applyProposalToMap,
} from "./futureWorkflowUtils";
import {
  proposeForNode,
  moveToProposal,
  type NodeProposal,
  type MapMove,
} from "@/lib/visualisations/node-proposals";
import { ProposalRail } from "./ProposalRail";
import type { ProposalPreview } from "../shared/MapEditContext";
import { EmptyState } from "@/components/ui/empty-state";
import { futureStateToMermaid } from "@/lib/visualisations/mermaid-export";
import {
  layoutNodesInLanes,
  nodesOverlap,
} from "@/lib/visualisations/auto-layout";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import type {
  FutureStateAIWorkflowMap as MapType,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import { generateId } from "@/lib/utils";

export function FutureStateAIWorkflowMap() {
  const { project, updateProject, syncRequests } = useWorkspace();
  const [generating, setGenerating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);
  const [preview, setPreview] = useState<ProposalPreview>(null);

  const map = project?.visualisations?.futureStateAIWorkflowMap ?? null;
  const currentMap = project?.visualisations?.currentStateWorkflowMap;

  const persist = useCallback(
    (next: MapType) => {
      if (!project) return;
      updateProject({
        visualisations: {
          ...(project.visualisations ?? {}),
          futureStateAIWorkflowMap: next,
        },
      });
    },
    [project, updateProject],
  );

  const { undo, redo, canUndo, canRedo } = useUndoRedo<MapType>(map, persist);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/generate/visualisations/future-state-workflow",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, currentStateMapId: currentMap?.id }),
        },
      );
      const data = await res.json();
      if (!data.map) {
        setError("Generation failed. Please try again.");
        return;
      }
      // Normalise positions through the swimlane auto-layout so the generated
      // map always lands tidy (no overlap), regardless of what the model /
      // template returned.
      const generated = data.map as MapType;
      const positions = layoutNodesInLanes(
        generated.nodes,
        generated.edges,
        FUTURE_LANE_Y,
        generated.lanes,
      );
      persist({
        ...generated,
        nodes: generated.nodes.map((n) => ({
          ...n,
          position: positions[n.id] ?? n.position,
        })),
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [project, persist, currentMap?.id]);

  const lastSyncSeen = useRef(syncRequests.future);
  useEffect(() => {
    if (syncRequests.future !== lastSyncSeen.current && !generating) {
      lastSyncSeen.current = syncRequests.future;
      void handleGenerate();
    }
  }, [syncRequests.future, generating, handleGenerate]);

  // One-shot auto-heal: maps generated under the older (tighter) lane spacing
  // can render with overlapping nodes. If we detect overlap on first view,
  // re-run the swimlane layout once so the canvas no longer "covers itself".
  const healedRef = useRef(false);
  useEffect(() => {
    if (!map || healedRef.current) return;
    if (!nodesOverlap(map.nodes)) return;
    healedRef.current = true;
    const positions = layoutNodesInLanes(
      map.nodes,
      map.edges,
      FUTURE_LANE_Y,
      map.lanes,
    );
    persist({
      ...map,
      nodes: map.nodes.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      })),
    });
  }, [map, persist]);

  const handleAddNode = useCallback(
    (type: FutureWorkflowNodeType) => {
      if (!map) return;
      const laneId =
        type === "ai_assist" || type === "ai_agent"
          ? "lane_ai"
          : type === "system_action" || type === "data_retrieval"
            ? "lane_systems"
            : type === "guardrail"
              ? "lane_guardrails"
              : type === "approval"
                ? "lane_compliance"
                : type === "monitoring" || type === "audit_log"
                  ? "lane_monitoring"
                  : "lane_human";
      const y = FUTURE_LANE_Y[laneId];
      const x = 200 + (map.nodes.length % 6) * 240;
      const node = newBlankFutureNode(type, laneId, { x, y });
      persist({
        ...map,
        nodes: [...map.nodes, node],
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
      setSelectedNodeId(node.id);
    },
    [map, persist],
  );

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<FutureWorkflowNode>) => {
      if (!map) return;
      persist({
        ...map,
        nodes: map.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [map, persist],
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      if (!map) return;
      persist({
        ...map,
        nodes: map.nodes.filter((n) => n.id !== id),
        edges: map.edges.filter((e) => e.source !== id && e.target !== id),
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
      setSelectedNodeId(null);
    },
    [map, persist],
  );

  const handleDuplicateNode = useCallback(
    (id: string) => {
      if (!map) return;
      const original = map.nodes.find((n) => n.id === id);
      if (!original) return;
      const dup: FutureWorkflowNode = {
        ...original,
        id: `${original.id}_copy_${Date.now()}`,
        title: `${original.title} (copy)`,
        position: { x: original.position.x + 40, y: original.position.y + 40 },
      };
      persist({
        ...map,
        nodes: [...map.nodes, dup],
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
      setSelectedNodeId(dup.id);
    },
    [map, persist],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!map) return;
    const ids = new Set<string>(multiSelectIds);
    if (selectedNodeId) ids.add(selectedNodeId);
    if (ids.size === 0) return;
    persist({
      ...map,
      nodes: map.nodes.filter((n) => !ids.has(n.id)),
      edges: map.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      source: "manual",
      updatedAt: new Date().toISOString(),
    });
    setSelectedNodeId(null);
    setMultiSelectIds([]);
  }, [map, multiSelectIds, selectedNodeId, persist]);

  const handleDuplicateSelected = useCallback(() => {
    if (!map) return;
    const ids = new Set<string>(multiSelectIds);
    if (selectedNodeId) ids.add(selectedNodeId);
    if (ids.size === 0) return;
    const copies: FutureWorkflowNode[] = [];
    map.nodes.forEach((n) => {
      if (!ids.has(n.id)) return;
      copies.push({
        ...n,
        id: `${n.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${n.title} (copy)`,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
      });
    });
    persist({
      ...map,
      nodes: [...map.nodes, ...copies],
      source: "manual",
      updatedAt: new Date().toISOString(),
    });
  }, [map, multiSelectIds, selectedNodeId, persist]);

  const handleNudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (!map) return;
      const ids = new Set<string>(multiSelectIds);
      if (selectedNodeId) ids.add(selectedNodeId);
      if (ids.size === 0) return;
      persist({
        ...map,
        nodes: map.nodes.map((n) =>
          ids.has(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        ),
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [map, multiSelectIds, selectedNodeId, persist],
  );

  const handleAutoLayout = useCallback(() => {
    if (!map || map.nodes.length === 0) return;
    const positions = layoutNodesInLanes(
      map.nodes,
      map.edges,
      FUTURE_LANE_Y,
      map.lanes,
    );
    persist({
      ...map,
      nodes: map.nodes.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      })),
      source: "manual",
      updatedAt: new Date().toISOString(),
    });
  }, [map, persist]);

  const handleReset = useCallback(() => {
    if (!project) return;
    const next = { ...(project.visualisations ?? {}) };
    delete next.futureStateAIWorkflowMap;
    updateProject({ visualisations: next });
    setSelectedNodeId(null);
    setMultiSelectIds([]);
  }, [project, updateProject]);

  const handleConvertToRequirement = useCallback(
    (node: FutureWorkflowNode) => {
      if (!project) return;
      const newReq = {
        id: generateId(),
        title: node.title,
        description:
          node.description ??
          `Requirement derived from future-state workflow node: ${node.title}`,
        category: "functional" as const,
        priority: "must_have" as const,
        source: "generated" as const,
        owner: "shared" as const,
        status: "assumption" as const,
      };
      updateProject({ requirements: [...project.requirements, newReq] });
    },
    [project, updateProject],
  );

  // ── Proposals (Pass 6) ────────────────────────────────────────────────────
  const getProposals = useCallback(
    (nodeId: string): NodeProposal[] => {
      if (!map || !project) return [];
      const n = map.nodes.find((x) => x.id === nodeId);
      return n ? proposeForNode(n, map, project) : [];
    },
    [map, project],
  );

  const handleApplyProposal = useCallback(
    (proposal: NodeProposal, sourceNodeId: string | null) => {
      if (!map) return;
      const { map: next, insertedIds } = applyProposalToMap(
        map,
        proposal,
        sourceNodeId,
      );
      // Safety net: an AI/single add should never land floating. If any
      // inserted node ended up with no edge and we know an anchor (the passed
      // source, or the proposal's preferred source from the map-aware AI
      // path), wire source → node so the new agent connects to the workflow.
      const effectiveSource =
        sourceNodeId ?? proposal.preferredSourceNodeId ?? null;
      if (effectiveSource && proposal.scope !== "workflow") {
        const touched = new Set<string>();
        for (const e of next.edges) {
          touched.add(e.source);
          touched.add(e.target);
        }
        const orphans = insertedIds.filter((id) => !touched.has(id));
        if (
          orphans.length > 0 &&
          next.nodes.some((n) => n.id === effectiveSource)
        ) {
          next.edges = [
            ...next.edges,
            ...orphans.map((id) => ({
              id: `e_${effectiveSource}_${id}`,
              source: effectiveSource,
              target: id,
              label: "input",
              style: "solid" as const,
            })),
          ];
        }
      }
      // Workflow blueprints add a whole sub-graph; single adds can still land
      // on top of an existing node. Tidy via auto-layout whenever the result
      // would overlap, so a newly-added workflow never covers itself.
      if (proposal.scope === "workflow" || nodesOverlap(next.nodes)) {
        const positions = layoutNodesInLanes(
          next.nodes,
          next.edges,
          FUTURE_LANE_Y,
          next.lanes,
        );
        next.nodes = next.nodes.map((n) => ({
          ...n,
          position: positions[n.id] ?? n.position,
        }));
      }
      persist(next);
      if (insertedIds[0]) setSelectedNodeId(insertedIds[0]);
    },
    [map, persist],
  );

  // "Ask AI for ideas" — call the MAP-AWARE recommend endpoint with the live
  // graph. Each returned move names an existing node to anchor to, so the
  // mapped proposals carry preferredSourceNodeId and land wired into the right
  // stage (not floating). nodeId === "__map__" means "whole map" (the rail);
  // any real node id focuses the AI on that stage (the node popover).
  const askAiForNode = useCallback(
    async (nodeId: string): Promise<NodeProposal[]> => {
      if (!project || !map) return [];
      const focusNodeId = nodeId && nodeId !== "__map__" ? nodeId : undefined;
      try {
        const res = await fetch("/api/recommend/map-moves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, map, focusNodeId }),
        });
        const data = await res.json();
        if (!Array.isArray(data.moves)) return [];
        return (data.moves as MapMove[]).map(moveToProposal);
      } catch {
        return [];
      }
    },
    [project, map],
  );

  const handleExportMermaid = useCallback(() => {
    if (!map || !project) return;
    const mmd = futureStateToMermaid(map);
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    downloadText(mmd, `${slug}-future-state-ai-workflow.mmd`, "text/plain");
  }, [map, project]);

  const handleExportJson = useCallback(() => {
    if (!map || !project) return;
    const json = JSON.stringify(map, null, 2);
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    downloadText(
      json,
      `${slug}-future-state-ai-workflow.json`,
      "application/json",
    );
  }, [map, project]);

  useCanvasShortcuts(
    {
      onUndo: undo,
      onRedo: redo,
      onDuplicate: handleDuplicateSelected,
      onDelete: handleDeleteSelected,
      onAutoLayout: handleAutoLayout,
      onNudge: handleNudgeSelected,
      onEscape: () => {
        setSelectedNodeId(null);
        setContextMenu(null);
      },
    },
    !!map,
  );

  const selectedNode = map?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const stale = useMemo(() => {
    if (!map || !project) return false;
    if (!map.derivedFromHash) return false;
    return map.derivedFromHash !== hashWorkflows(project.workflows);
  }, [map, project]);

  const nodeContextItems: ContextMenuItem[] = contextMenu?.nodeId
    ? [
        {
          type: "item",
          label: "Duplicate",
          shortcut: "⌘D",
          onClick: () => handleDuplicateNode(contextMenu.nodeId!),
        },
        { type: "separator" },
        {
          type: "item",
          label: "Convert to requirement →",
          onClick: () => {
            const n = map?.nodes.find((x) => x.id === contextMenu.nodeId);
            if (n) handleConvertToRequirement(n);
          },
        },
        { type: "separator" },
        {
          type: "item",
          label: "Delete",
          shortcut: "⌫",
          danger: true,
          onClick: () => handleDeleteNode(contextMenu.nodeId!),
        },
      ]
    : [];

  const paneContextItems: ContextMenuItem[] = [
    {
      type: "submenu",
      label: "Add node here",
      items: [
        {
          type: "item",
          label: "AI assist",
          onClick: () => handleAddNode("ai_assist"),
        },
        {
          type: "item",
          label: "AI agent",
          onClick: () => handleAddNode("ai_agent"),
        },
        {
          type: "item",
          label: "Human action",
          onClick: () => handleAddNode("human_action"),
        },
        {
          type: "item",
          label: "Guardrail",
          onClick: () => handleAddNode("guardrail"),
        },
        {
          type: "item",
          label: "Decision gate",
          onClick: () => handleAddNode("decision_gate"),
        },
        {
          type: "item",
          label: "Monitoring",
          onClick: () => handleAddNode("monitoring"),
        },
        {
          type: "item",
          label: "Audit log",
          onClick: () => handleAddNode("audit_log"),
        },
      ],
    },
    { type: "separator" },
    {
      type: "item",
      label: "Auto-layout (tidy)",
      shortcut: "⌘L",
      onClick: handleAutoLayout,
    },
    {
      type: "item",
      label: "Undo",
      shortcut: "⌘Z",
      onClick: undo,
      disabled: !canUndo,
    },
    {
      type: "item",
      label: "Redo",
      shortcut: "⌘⇧Z",
      onClick: redo,
      disabled: !canRedo,
    },
  ];

  return (
    <div className="space-y-3">
      <VisualisationFrame
        title="Future-State AI Workflow Map"
        subtitle="Double-click to rename · Right-click for actions · ⌘Z undo · ⌘L tidy · drag-select to multi-pick"
        titleBadge={map ? <SourceBadge source={map.source} /> : null}
        lastSavedAt={map?.updatedAt}
        banner={
          map ? (
            <StaleBanner
              stale={stale}
              generating={generating}
              onSync={handleGenerate}
              variant="future"
            />
          ) : null
        }
        toolbar={
          <FutureWorkflowToolbar
            generating={generating}
            hasMap={!!map}
            hasCurrentMap={!!currentMap}
            comparing={comparing}
            source={map?.source}
            canUndo={canUndo}
            canRedo={canRedo}
            onGenerate={handleGenerate}
            onToggleCompare={() => setComparing((v) => !v)}
            onUndo={undo}
            onRedo={redo}
            onAutoLayout={handleAutoLayout}
            onAddNode={handleAddNode}
            onExportMermaid={handleExportMermaid}
            onExportJson={handleExportJson}
            onReset={handleReset}
          />
        }
        canvas={
          map ? (
            <FutureWorkflowCanvas
              map={map}
              onChange={persist}
              onSelectNode={setSelectedNodeId}
              selectedNodeId={selectedNodeId}
              onMultiSelectChange={setMultiSelectIds}
              onNodeContextMenu={(nodeId, x, y) =>
                setContextMenu({ nodeId, x, y })
              }
              onPaneContextMenu={(x, y) =>
                setContextMenu({ nodeId: null, x, y })
              }
              onDuplicateNode={handleDuplicateNode}
              onDeleteNode={handleDeleteNode}
              onConvertToRequirement={(id) => {
                const n = map?.nodes.find((x) => x.id === id);
                if (n) handleConvertToRequirement(n);
              }}
              getProposals={getProposals}
              onApplyProposal={handleApplyProposal}
              onAskAiForNode={askAiForNode}
              preview={preview}
              onPreviewChange={setPreview}
            />
          ) : (
            <div className="h-full flex items-center justify-center px-8">
              <EmptyState
                icon="🤖"
                title="No future-state map yet"
                body={
                  <>
                    Designs the AI-enabled workflow from your current-state map
                    + project context (guardrails, monitoring, human approvals).
                    {!currentMap && (
                      <span className="block mt-1 text-amber-700">
                        Tip: generate the Current-State map first for a richer
                        design.
                      </span>
                    )}
                    {error && (
                      <span className="block mt-1 text-destructive">
                        {error}
                      </span>
                    )}
                  </>
                }
                tone="prominent"
                cta={
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
                  >
                    {generating ? "Generating…" : "✨ Generate map"}
                  </button>
                }
              />
            </div>
          )
        }
        inspector={
          map ? (
            <FutureWorkflowInspectorPanel
              node={selectedNode}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onConvertToRequirement={handleConvertToRequirement}
            />
          ) : undefined
        }
        rail={
          map && project ? (
            <ProposalRail
              map={map}
              project={project}
              onApply={handleApplyProposal}
              onPreview={(p, sid) =>
                setPreview(p ? { proposal: p, sourceNodeId: sid } : null)
              }
              onAskAi={() => askAiForNode("__map__")}
            />
          ) : undefined
        }
        inspectorOpen={!!selectedNodeId}
        onInspectorOpenChange={(open) => {
          if (!open) setSelectedNodeId(null);
        }}
        legend={map ? <FutureWorkflowLegend /> : undefined}
      />

      {map && comparing && (
        <CurrentFutureComparisonPanel current={currentMap} future={map} />
      )}

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.nodeId ? nodeContextItems : paneContextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
