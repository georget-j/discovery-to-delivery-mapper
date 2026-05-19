"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { VisualisationFrame } from "../shared/VisualisationFrame";
import { downloadText } from "../shared/export-helpers";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowInspectorPanel } from "./WorkflowInspectorPanel";
import { WorkflowToolbar } from "./WorkflowToolbar";
import { WorkflowLegend } from "./WorkflowLegend";
import { newBlankNode, CURRENT_LANE_Y, DEFAULT_CURRENT_LANES } from "./workflowUtils";
import { currentStateToMermaid } from "@/lib/visualisations/mermaid-export";
import type {
  CurrentStateWorkflowMap as MapType,
  WorkflowNode,
  WorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import { generateId } from "@/lib/utils";

export function CurrentStateWorkflowMap() {
  const { project, updateProject } = useWorkspace();
  const [generating, setGenerating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    [project, updateProject]
  );

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/visualisations/current-state-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
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
  }, [project, persist]);

  const handleAddNode = useCallback(
    (type: WorkflowNodeType) => {
      if (!map) return;
      const laneId =
        type === "system_step" ? "lane_systems"
        : type === "risk" || type === "missing_info" ? "lane_notes"
        : type === "decision" ? "lane_compliance"
        : "lane_operator";
      const y = CURRENT_LANE_Y[laneId];
      const x = 200 + (map.nodes.length % 6) * 240;
      const node = newBlankNode(type, laneId, { x, y });
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
    (id: string, patch: Partial<WorkflowNode>) => {
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
    delete next.currentStateWorkflowMap;
    updateProject({ visualisations: next });
    setSelectedNodeId(null);
  }, [project, updateProject]);

  const handleConvertToRisk = useCallback(
    (node: WorkflowNode) => {
      if (!project) return;
      const newRisk = {
        id: generateId(),
        title: node.title,
        description: node.description ?? `Risk identified at "${node.title}" in the current-state workflow.`,
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
    [project, updateProject]
  );

  const handleExportMermaid = useCallback(() => {
    if (!map || !project) return;
    const mmd = currentStateToMermaid(map);
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadText(mmd, `${slug}-current-state-workflow.mmd`, "text/plain");
  }, [map, project]);

  const handleExportJson = useCallback(() => {
    if (!map || !project) return;
    const json = JSON.stringify(map, null, 2);
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadText(json, `${slug}-current-state-workflow.json`, "application/json");
  }, [map, project]);

  const selectedNode = map?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <VisualisationFrame
      title="Current-State Workflow Map"
      subtitle="A swimlane-style map of how work happens today — handoffs, systems, manual steps, and evidence gaps."
      toolbar={
        <WorkflowToolbar
          generating={generating}
          hasMap={!!map}
          source={map?.source}
          onGenerate={handleGenerate}
          onAddNode={handleAddNode}
          onExportMermaid={handleExportMermaid}
          onExportJson={handleExportJson}
          onReset={handleReset}
        />
      }
      canvas={
        map ? (
          <WorkflowCanvas
            map={map}
            onChange={persist}
            onSelectNode={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-3">
            <p className="text-sm text-muted-foreground max-w-md">
              No current-state map yet. Click <strong className="text-foreground">AI Generate</strong> to build one from your workflow steps and systems.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
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
      legend={map ? <WorkflowLegend /> : undefined}
    />
  );
}
