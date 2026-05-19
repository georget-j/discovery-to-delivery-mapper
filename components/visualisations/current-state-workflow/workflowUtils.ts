import type { Node as RFNode, Edge as RFEdge, MarkerType } from "@xyflow/react";
import type {
  CurrentStateWorkflowMap,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowLane,
} from "@/lib/visualisations/workflow-types";

export const CURRENT_LANE_Y: Record<string, number> = {
  lane_operator: 80,
  lane_systems: 240,
  lane_compliance: 400,
  lane_notes: 560,
};

export const DEFAULT_CURRENT_LANES: WorkflowLane[] = [
  { id: "lane_operator", title: "Operator", description: "Human work" },
  { id: "lane_systems", title: "Systems", description: "Current tools" },
  { id: "lane_compliance", title: "Compliance", description: "Review / audit" },
  { id: "lane_notes", title: "FDE Notes", description: "Gaps & risks" },
];

export function mapToReactFlowNodes(map: CurrentStateWorkflowMap): RFNode[] {
  return map.nodes.map((n) => ({
    id: n.id,
    type: "workflow",
    position: n.position,
    data: n as unknown as Record<string, unknown>,
    draggable: true,
  }));
}

export function mapToReactFlowEdges(map: CurrentStateWorkflowMap): RFEdge[] {
  return map.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    animated: false,
    style: {
      stroke: e.style === "dashed" ? "#94a3b8" : "#475569",
      strokeWidth: 1.5,
      strokeDasharray: e.style === "dashed" ? "4 3" : undefined,
    },
    markerEnd: { type: "arrowclosed" as MarkerType, color: e.style === "dashed" ? "#94a3b8" : "#475569" },
  }));
}

export function newBlankNode(type: WorkflowNodeType, laneId: string, position: { x: number; y: number }): WorkflowNode {
  return {
    id: `n_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    laneId,
    title: typeToDefaultTitle(type),
    position,
  };
}

function typeToDefaultTitle(t: WorkflowNodeType): string {
  const labels: Record<WorkflowNodeType, string> = {
    human_step: "New step",
    system_step: "New system",
    decision: "Decision",
    handoff: "Handoff",
    delay: "Delay",
    risk: "New risk",
    missing_info: "Missing info",
    data_object: "Data object",
  };
  return labels[t];
}

// Resolve the laneId for a node based on its current y-position (after a drag).
export function laneIdForY(y: number, lanes: WorkflowLane[]): string {
  const laneYs = lanes.map((l) => ({ id: l.id, y: CURRENT_LANE_Y[l.id] ?? 0 }));
  let closest = laneYs[0];
  for (const l of laneYs) {
    if (Math.abs(y - l.y) < Math.abs(y - closest.y)) closest = l;
  }
  return closest.id;
}
