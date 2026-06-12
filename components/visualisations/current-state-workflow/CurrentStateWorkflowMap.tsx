"use client";

import { notifyGenerationOutcome } from "../shared/generation-feedback";
import { ConfirmActionModal } from "../shared/ConfirmActionModal";
import { retrieveForTarget } from "@/lib/kb/retrieve";
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
import { useCanvasActive } from "../shared/CanvasActivityContext";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowInspectorPanel } from "./WorkflowInspectorPanel";
import { WorkflowToolbar } from "./WorkflowToolbar";
import { WorkflowLegend } from "./WorkflowLegend";
import {
  newBlankNode,
  laneIdForY,
  CURRENT_LANE_Y,
  EDIT_NODE_TITLE_EVENT,
} from "./workflowUtils";
import { currentStateToMermaid } from "@/lib/visualisations/mermaid-export";
import { layoutNodesInLanes } from "@/lib/visualisations/auto-layout";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  CurrentStateWorkflowMap as MapType,
  WorkflowNode,
  WorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import { generateId } from "@/lib/utils";

export function CurrentStateWorkflowMap() {
  const { project, updateProject, syncRequests } = useWorkspace();
  // False while this map's tab is CSS-hidden — gates the window-level shortcuts.
  const isActive = useCanvasActive();
  const [generating, setGenerating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
    // Canvas-space position of a pane right-click, for "Add node here".
    flowPos?: { x: number; y: number };
  } | null>(null);

  const map = project?.visualisations?.currentStateWorkflowMap ?? null;

  const persist = useCallback(
    (next: MapType) => {
      if (!project) return;
      updateProject({
        visualisations: {
          ...(project.visualisations ?? {}),
          currentStateWorkflowMap: next,
        },
      });
    },
    [project, updateProject],
  );

  const { undo, redo, canUndo, canRedo } = useUndoRedo<MapType>(map, persist);

  // Watch for external sync requests (e.g. from the WorkflowTabs Stale badge).
  // The ref tracks the last counter we acted on so we ignore the mount value.
  const lastSyncSeen = useRef(syncRequests.current);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  const runGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);
    setError(null);
    try {
      // Ground the map in uploaded documents when a KB exists. Retrieval
      // failure (no KB, embed error) just means an ungrounded generation.
      let contextChunks: { id: string; text: string; label?: string }[] = [];
      try {
        const retrieved = await retrieveForTarget(project.id, "workflows", 8);
        contextChunks = retrieved.map((r) => ({
          id: r.chunk.id,
          text: r.chunk.text.slice(0, 4000),
          label: r.label,
        }));
      } catch {
        // KB unavailable — generate from project context alone.
      }
      const res = await fetch(
        "/api/generate/visualisations/current-state-workflow",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, contextChunks }),
        },
      );
      const data = await res.json();
      if (!data.map) {
        setError("Generation failed. Please try again.");
        return;
      }
      notifyGenerationOutcome(data);
      // Normalise positions through the swimlane auto-layout so the generated
      // map lands tidy (no overlap), regardless of returned positions.
      const generated = data.map as MapType;
      const positions = layoutNodesInLanes(
        generated.nodes,
        generated.edges,
        CURRENT_LANE_Y,
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
  }, [project, persist]);

  // Manual edits (added/edited nodes flip source to "manual") are destroyed
  // by a regenerate — route those through an explicit confirm instead of
  // silently replacing the user's work.
  const handleGenerate = useCallback(async () => {
    if (map && map.source === "manual") {
      setConfirmRegenOpen(true);
      return;
    }
    await runGenerate();
  }, [map, runGenerate]);

  useEffect(() => {
    if (syncRequests.current !== lastSyncSeen.current && !generating) {
      lastSyncSeen.current = syncRequests.current;
      void handleGenerate();
    }
  }, [syncRequests.current, generating, handleGenerate]);

  const handleAddNode = useCallback(
    (type: WorkflowNodeType, atPos?: { x: number; y: number }) => {
      if (!map) return;
      // With an explicit position the lane follows the drop point (same rule
      // as dragging); otherwise the node type picks its default lane.
      const laneId = atPos
        ? laneIdForY(atPos.y, map.lanes)
        : type === "system_step"
          ? "lane_systems"
          : type === "risk" || type === "missing_info"
            ? "lane_notes"
            : type === "decision"
              ? "lane_compliance"
              : "lane_operator";
      const y = atPos?.y ?? CURRENT_LANE_Y[laneId];
      const x = atPos?.x ?? 200 + (map.nodes.length % 6) * 240;
      const node = newBlankNode(type, laneId, { x, y });
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
    (id: string, patch: Partial<WorkflowNode>) => {
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
      const dup: WorkflowNode = {
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
    const copies: WorkflowNode[] = [];
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
      CURRENT_LANE_Y,
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

  // Reset is confirmed via modal and keeps a one-shot in-memory snapshot so
  // the empty state can offer "Restore" (the undo stack dies with the map).
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetSnapshot, setResetSnapshot] = useState<MapType | null>(null);

  const handleReset = useCallback(() => {
    if (!project || !map) return;
    setResetSnapshot(map);
    const next = { ...(project.visualisations ?? {}) };
    delete next.currentStateWorkflowMap;
    updateProject({ visualisations: next });
    setSelectedNodeId(null);
    setMultiSelectIds([]);
  }, [project, map, updateProject]);

  const handleRestoreReset = useCallback(() => {
    if (!resetSnapshot) return;
    persist(resetSnapshot);
    setResetSnapshot(null);
  }, [resetSnapshot, persist]);

  const handleConvertToRisk = useCallback(
    (node: WorkflowNode) => {
      if (!project) return;
      const newRisk = {
        id: generateId(),
        title: node.title,
        description:
          node.description ??
          `Risk identified at "${node.title}" in the current-state workflow.`,
        category: "operational_adoption" as const,
        severity: "medium" as const,
        likelihood: "medium" as const,
        owner: node.owner ?? "",
        mitigation: "",
        escalationTrigger: "",
        status: "open" as const,
        source: "manual" as const,
      };
      updateProject({ risks: [...project.risks, newRisk] });
    },
    [project, updateProject],
  );

  const handleExportMermaid = useCallback(() => {
    if (!map || !project) return;
    const mmd = currentStateToMermaid(map);
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    downloadText(mmd, `${slug}-current-state-workflow.mmd`, "text/plain");
  }, [map, project]);

  const handleExportJson = useCallback(() => {
    if (!map || !project) return;
    const json = JSON.stringify(map, null, 2);
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    downloadText(
      json,
      `${slug}-current-state-workflow.json`,
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
    !!map && isActive,
  );

  const selectedNode = map?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Stale when the workflow steps have changed since this map was generated.
  // Legacy maps without derivedFromHash are treated as fresh.
  const stale = useMemo(() => {
    if (!map || !project) return false;
    if (!map.derivedFromHash) return false;
    return map.derivedFromHash !== hashWorkflows(project.workflows);
  }, [map, project]);

  // Context menu items
  const nodeContextItems: ContextMenuItem[] = contextMenu?.nodeId
    ? [
        {
          type: "item",
          label: "Duplicate",
          shortcut: "⌘D",
          onClick: () => handleDuplicateNode(contextMenu.nodeId!),
        },
        {
          type: "item",
          label: "Edit title",
          onClick: () => {
            setSelectedNodeId(contextMenu.nodeId);
            // The matching WorkflowNode opens its inline rename input.
            window.dispatchEvent(
              new CustomEvent(EDIT_NODE_TITLE_EVENT, {
                detail: { id: contextMenu.nodeId },
              }),
            );
          },
        },
        { type: "separator" },
        {
          type: "item",
          label: "Convert to risk →",
          onClick: () => {
            const n = map?.nodes.find((x) => x.id === contextMenu.nodeId);
            if (n) handleConvertToRisk(n);
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

  // "Add node here" drops the node at the right-clicked canvas position.
  const paneFlowPos = contextMenu?.flowPos;
  const paneContextItems: ContextMenuItem[] = [
    {
      type: "submenu",
      label: "Add node here",
      items: [
        {
          type: "item",
          label: "Human step",
          onClick: () => handleAddNode("human_step", paneFlowPos),
        },
        {
          type: "item",
          label: "System step",
          onClick: () => handleAddNode("system_step", paneFlowPos),
        },
        {
          type: "item",
          label: "Decision",
          onClick: () => handleAddNode("decision", paneFlowPos),
        },
        {
          type: "item",
          label: "Risk",
          onClick: () => handleAddNode("risk", paneFlowPos),
        },
        {
          type: "item",
          label: "Missing info",
          onClick: () => handleAddNode("missing_info", paneFlowPos),
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
    <>
      <VisualisationFrame
        title="Current-State Workflow Map"
        subtitle="Double-click to rename · Right-click for actions · ⌘Z undo · ⌘L tidy · drag-select to multi-pick"
        titleBadge={map ? <SourceBadge source={map.source} /> : null}
        lastSavedAt={map?.updatedAt}
        banner={
          map ? (
            <StaleBanner
              stale={stale}
              generating={generating}
              onSync={handleGenerate}
              variant="current"
            />
          ) : null
        }
        toolbar={
          <WorkflowToolbar
            generating={generating}
            hasMap={!!map}
            source={map?.source}
            canUndo={canUndo}
            canRedo={canRedo}
            onGenerate={handleGenerate}
            onUndo={undo}
            onRedo={redo}
            onAutoLayout={handleAutoLayout}
            onAddNode={(t) => handleAddNode(t)}
            onExportMermaid={handleExportMermaid}
            onExportJson={handleExportJson}
            onReset={() => setConfirmResetOpen(true)}
          />
        }
        canvas={
          map ? (
            <WorkflowCanvas
              map={map}
              onChange={persist}
              onSelectNode={setSelectedNodeId}
              selectedNodeId={selectedNodeId}
              onMultiSelectChange={setMultiSelectIds}
              onNodeContextMenu={(nodeId, x, y) =>
                setContextMenu({ nodeId, x, y })
              }
              onPaneContextMenu={(x, y, flowPosition) =>
                setContextMenu({ nodeId: null, x, y, flowPos: flowPosition })
              }
              onDuplicateNode={handleDuplicateNode}
              onDeleteNode={handleDeleteNode}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8">
              {resetSnapshot && (
                <div className="flex items-center gap-2 text-xs rounded-md border bg-background px-3 py-1.5 shadow-sm">
                  <span className="text-muted-foreground">Map reset.</span>
                  <button
                    type="button"
                    onClick={handleRestoreReset}
                    className="font-medium text-primary hover:underline"
                  >
                    Restore
                  </button>
                </div>
              )}
              <EmptyState
                icon="🗺"
                title="No current-state map yet"
                body={
                  <>
                    Builds an interactive swimlane map from your workflow steps
                    and systems.
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
            <WorkflowInspectorPanel
              node={selectedNode}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onConvertToRisk={handleConvertToRisk}
            />
          ) : undefined
        }
        inspectorOpen={!!selectedNodeId}
        onInspectorOpenChange={(open) => {
          if (!open) setSelectedNodeId(null);
        }}
        legend={map ? <WorkflowLegend /> : undefined}
      />

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.nodeId ? nodeContextItems : paneContextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <ConfirmActionModal
        open={confirmRegenOpen}
        onOpenChange={setConfirmRegenOpen}
        title="Regenerate over manual edits?"
        description="This map contains manual edits. Regenerating replaces it with a fresh AI map — undo (⌘Z) can bring the current version back during this session."
        confirmLabel="Regenerate map"
        onConfirm={() => void runGenerate()}
      />

      <ConfirmActionModal
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset this map?"
        description="This deletes the current-state map. A one-time Restore stays available on the empty canvas until you generate again or leave the page."
        confirmLabel="Reset map"
        onConfirm={handleReset}
      />
    </>
  );
}
