"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { VisualisationFrame } from "../shared/VisualisationFrame";
import { downloadText } from "../shared/export-helpers";
import { FutureWorkflowCanvas } from "./FutureWorkflowCanvas";
import { FutureWorkflowInspectorPanel } from "./FutureWorkflowInspectorPanel";
import { FutureWorkflowToolbar } from "./FutureWorkflowToolbar";
import { FutureWorkflowLegend } from "./FutureWorkflowLegend";
import { CurrentFutureComparisonPanel } from "./CurrentFutureComparisonPanel";
import { newBlankFutureNode, FUTURE_LANE_Y } from "./futureWorkflowUtils";
import { futureStateToMermaid } from "@/lib/visualisations/mermaid-export";
import type {
  FutureStateAIWorkflowMap as MapType,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import { generateId } from "@/lib/utils";

export function FutureStateAIWorkflowMap() {
  const { project, updateProject } = useWorkspace();
  const [generating, setGenerating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    [project, updateProject]
  );

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/visualisations/future-state-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, currentStateMapId: currentMap?.id }),
      });
      const data = await res.json();
      if (!data.map) {
        setError("Generation failed. Please try again.");
        return;
      }
      persist(data.map as MapType);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [project, persist, currentMap?.id]);

  const handleAddNode = useCallback(
    (type: FutureWorkflowNodeType) => {
      if (!map) return;
      const laneId =
        type === "ai_assist" || type === "ai_agent" ? "lane_ai"
        : type === "system_action" || type === "data_retrieval" ? "lane_systems"
        : type === "guardrail" ? "lane_guardrails"
        : type === "approval" ? "lane_compliance"
        : type === "monitoring" || type === "audit_log" ? "lane_monitoring"
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
    [map, persist]
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
    [map, persist]
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
    [map, persist]
  );

  const handleReset = useCallback(() => {
    if (!project) return;
    const next = { ...(project.visualisations ?? {}) };
    delete next.futureStateAIWorkflowMap;
    updateProject({ visualisations: next });
    setSelectedNodeId(null);
  }, [project, updateProject]);

  const handleConvertToRequirement = useCallback(
    (node: FutureWorkflowNode) => {
      if (!project) return;
      const newReq = {
        id: generateId(),
        title: node.title,
        description: node.description ?? `Requirement derived from future-state workflow node: ${node.title}`,
        category: "functional" as const,
        priority: "must_have" as const,
        source: "generated" as const,
        owner: "shared" as const,
        status: "assumption" as const,
      };
      updateProject({ requirements: [...project.requirements, newReq] });
    },
    [project, updateProject]
  );

  const handleExportMermaid = useCallback(() => {
    if (!map || !project) return;
    const mmd = futureStateToMermaid(map);
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadText(mmd, `${slug}-future-state-ai-workflow.mmd`, "text/plain");
  }, [map, project]);

  const handleExportJson = useCallback(() => {
    if (!map || !project) return;
    const json = JSON.stringify(map, null, 2);
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadText(json, `${slug}-future-state-ai-workflow.json`, "application/json");
  }, [map, project]);

  const selectedNode = map?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="space-y-3">
      <VisualisationFrame
        title="Future-State AI Workflow Map"
        subtitle="Shows how the redesigned workflow uses AI assistance, retrieval, guardrails, human review, audit logging, and monitoring."
        toolbar={
          <FutureWorkflowToolbar
            generating={generating}
            hasMap={!!map}
            hasCurrentMap={!!currentMap}
            comparing={comparing}
            source={map?.source}
            onGenerate={handleGenerate}
            onToggleCompare={() => setComparing((v) => !v)}
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
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-3">
              <p className="text-sm text-muted-foreground max-w-md">
                No future-state map yet. Click <strong className="text-foreground">AI Generate</strong> to design the AI-enabled workflow from your current-state map and project context.
              </p>
              {!currentMap && (
                <p className="text-[11px] text-amber-700">Tip: generate the Current-State Workflow Map first for a richer future-state design.</p>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
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
        legend={map ? <FutureWorkflowLegend /> : undefined}
      />

      {map && comparing && (
        <CurrentFutureComparisonPanel current={currentMap} future={map} />
      )}
    </div>
  );
}
