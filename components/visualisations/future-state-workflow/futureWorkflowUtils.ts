import type { Node as RFNode, Edge as RFEdge, MarkerType } from "@xyflow/react";
import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
  WorkflowLane,
  CurrentStateWorkflowMap,
} from "@/lib/visualisations/workflow-types";
import type { NodeProposal } from "@/lib/visualisations/node-proposals";

export const FUTURE_LANE_Y: Record<string, number> = {
  lane_human: 80,
  lane_ai: 200,
  lane_systems: 320,
  lane_guardrails: 440,
  lane_compliance: 560,
  lane_monitoring: 680,
};

export const DEFAULT_FUTURE_LANES: WorkflowLane[] = [
  { id: "lane_human", title: "Human", description: "Human decision" },
  {
    id: "lane_ai",
    title: "AI Assistant",
    description: "Summarise / recommend",
  },
  {
    id: "lane_systems",
    title: "Systems & Data",
    description: "APIs / retrieval",
  },
  {
    id: "lane_guardrails",
    title: "Guardrails",
    description: "Policy / confidence",
  },
  {
    id: "lane_compliance",
    title: "Compliance",
    description: "Audit / supervisor",
  },
  {
    id: "lane_monitoring",
    title: "Monitoring",
    description: "Telemetry / feedback",
  },
];

export function mapToReactFlowNodes(map: FutureStateAIWorkflowMap): RFNode[] {
  return map.nodes.map((n) => ({
    id: n.id,
    type: "future_workflow",
    position: n.position,
    data: n as unknown as Record<string, unknown>,
    draggable: true,
  }));
}

export function mapToReactFlowEdges(map: FutureStateAIWorkflowMap): RFEdge[] {
  // Edges that touch an AI node get an animated dashed flow so the "AI path"
  // through the workflow reads as alive — the single biggest signal that this
  // is a designed product surface and not a static diagram.
  const aiNodeIds = new Set(
    map.nodes
      .filter((n) => n.type === "ai_assist" || n.type === "ai_agent")
      .map((n) => n.id),
  );
  return map.edges.map((e) => {
    const touchesAi = aiNodeIds.has(e.source) || aiNodeIds.has(e.target);
    const dashed = e.style === "dashed";
    const stroke = dashed ? "#94a3b8" : touchesAi ? "#7c3aed" : "#475569";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      animated: touchesAi,
      style: {
        stroke,
        strokeWidth: 2,
        strokeLinecap: "round" as const,
        strokeDasharray: dashed ? "5 4" : undefined,
      },
      markerEnd: {
        type: "arrowclosed" as MarkerType,
        color: stroke,
        width: 16,
        height: 16,
      },
    };
  });
}

const TYPE_LABELS: Record<FutureWorkflowNodeType, string> = {
  human_action: "New human action",
  ai_assist: "New AI assist",
  ai_agent: "New AI agent",
  system_action: "New system action",
  data_retrieval: "New data retrieval",
  guardrail: "New guardrail",
  decision_gate: "Decision",
  approval: "New approval",
  monitoring: "New metric",
  audit_log: "Audit log",
  exception_path: "Exception path",
};

export function newBlankFutureNode(
  type: FutureWorkflowNodeType,
  laneId: string,
  position: { x: number; y: number },
): FutureWorkflowNode {
  return {
    id: `n_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    laneId,
    title: TYPE_LABELS[type],
    position,
    automationLevel:
      type === "ai_assist"
        ? "draft_only"
        : type === "ai_agent"
          ? "autonomous_with_guardrails"
          : undefined,
    requiredHumanApproval: type === "ai_assist" || type === "ai_agent",
    guardrails:
      type === "ai_assist" || type === "ai_agent"
        ? ["Confidence threshold"]
        : undefined,
  };
}

export function laneIdForY(y: number, lanes: WorkflowLane[]): string {
  const laneYs = lanes.map((l) => ({ id: l.id, y: FUTURE_LANE_Y[l.id] ?? 0 }));
  let closest = laneYs[0];
  for (const l of laneYs) {
    if (Math.abs(y - l.y) < Math.abs(y - closest.y)) closest = l;
  }
  return closest.id;
}

// ────────────────────────────────────────────────────────────
// Proposal application + ghost preview
// ────────────────────────────────────────────────────────────

// Position the inserted node(s) for a proposal. Each lands in its own lane's
// Y band, offset to the right of the source node (or the map's right edge when
// there's no source), with multiple nodes fanned out so they don't overlap.
function positionFor(
  spec: { laneId: string },
  index: number,
  map: FutureStateAIWorkflowMap,
  sourceNode: FutureWorkflowNode | undefined,
): { x: number; y: number } {
  const baseX = sourceNode
    ? sourceNode.position.x + 260
    : Math.max(200, ...map.nodes.map((n) => n.position.x + 240), 200);
  return {
    x: baseX + index * 240,
    y: FUTURE_LANE_Y[spec.laneId] ?? 200,
  };
}

// Build the concrete nodes (with ids + positions) a proposal would insert,
// plus the edges wiring them in. Shared by apply (persist) and the ghost
// preview (render translucent, don't persist).
export function buildProposalAdditions(
  map: FutureStateAIWorkflowMap,
  proposal: NodeProposal,
  sourceNodeId: string | null,
  idPrefix = "",
): { nodes: FutureWorkflowNode[]; edges: FutureStateAIWorkflowMap["edges"] } {
  const sourceNode = sourceNodeId
    ? map.nodes.find((n) => n.id === sourceNodeId)
    : undefined;
  const stamp = Date.now();
  const newNodes: FutureWorkflowNode[] = proposal.insert.nodes.map(
    (spec, i) => ({
      ...spec,
      id: `${idPrefix}n_${stamp}_${i}_${Math.floor(Math.random() * 1000)}`,
      position: positionFor(spec, i, map, sourceNode),
    }),
  );

  const edges: FutureStateAIWorkflowMap["edges"] = [];
  // Wire source → first new node when requested.
  if (proposal.insert.connectFromSource && sourceNodeId && newNodes[0]) {
    edges.push({
      id: `${idPrefix}e_${sourceNodeId}_${newNodes[0].id}`,
      source: sourceNodeId,
      target: newNodes[0].id,
      style: "solid",
    });
  }
  // Chain multiple inserted nodes in order.
  for (let i = 1; i < newNodes.length; i++) {
    edges.push({
      id: `${idPrefix}e_${newNodes[i - 1].id}_${newNodes[i].id}`,
      source: newNodes[i - 1].id,
      target: newNodes[i].id,
      style: "solid",
    });
  }
  return { nodes: newNodes, edges };
}

// Apply a proposal and return the next map (caller persists). Returns the ids
// of inserted nodes so the orchestrator can select the first one.
export function applyProposalToMap(
  map: FutureStateAIWorkflowMap,
  proposal: NodeProposal,
  sourceNodeId: string | null,
): { map: FutureStateAIWorkflowMap; insertedIds: string[] } {
  const { nodes, edges } = buildProposalAdditions(map, proposal, sourceNodeId);
  return {
    insertedIds: nodes.map((n) => n.id),
    map: {
      ...map,
      nodes: [...map.nodes, ...nodes],
      edges: [...map.edges, ...edges],
      source: "manual",
      updatedAt: new Date().toISOString(),
    },
  };
}

// ────────────────────────────────────────────────────────────
// Comparison
// ────────────────────────────────────────────────────────────

export type ComparisonStats = {
  addedAiNodes: number;
  addedGuardrails: number;
  addedMonitoring: number;
  totalCurrentSteps: number;
  totalFutureSteps: number;
  humanLedReduced: number;
  newRisks: string[];
};

export function diffWithCurrent(
  current: CurrentStateWorkflowMap | undefined,
  future: FutureStateAIWorkflowMap,
): ComparisonStats {
  const currentCount = current?.nodes.length ?? 0;
  const futureCount = future.nodes.length;
  const addedAi = future.nodes.filter(
    (n) => n.type === "ai_assist" || n.type === "ai_agent",
  ).length;
  const addedGuards = future.nodes.filter((n) => n.type === "guardrail").length;
  const addedMon = future.nodes.filter(
    (n) => n.type === "monitoring" || n.type === "audit_log",
  ).length;
  const currentHuman =
    current?.nodes.filter((n) => n.type === "human_step").length ?? 0;
  const futureHuman = future.nodes.filter(
    (n) => n.type === "human_action" || n.type === "approval",
  ).length;

  return {
    addedAiNodes: addedAi,
    addedGuardrails: addedGuards,
    addedMonitoring: addedMon,
    totalCurrentSteps: currentCount,
    totalFutureSteps: futureCount,
    humanLedReduced: Math.max(0, currentHuman - futureHuman),
    newRisks: future.newRisksIntroduced,
  };
}
