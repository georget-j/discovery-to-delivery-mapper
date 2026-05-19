// Auto-layout for swimlane workflow maps.
// Sorts nodes topologically within each lane and spaces them evenly,
// keeping each node within its lane's y-position.

import dagre from "@dagrejs/dagre";
import type { WorkflowEdge, WorkflowLane } from "./workflow-types";

type Edgey = Pick<WorkflowEdge, "source" | "target">;
type LayoutNode = { id: string; laneId: string };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;
const X_PADDING = 80;
const X_STEP = 240;

export function layoutNodesInLanes<N extends LayoutNode>(
  nodes: N[],
  edges: Edgey[],
  laneYs: Record<string, number>,
  lanes: WorkflowLane[],
): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};

  // Run dagre once over the full graph to get a topological x-order.
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  // Pull dagre's x coordinates, then rebase per lane so nodes within a lane
  // start at X_PADDING and are spaced by their relative x-order.
  const dagreX = new Map<string, number>();
  for (const n of nodes) {
    const dn = g.node(n.id);
    dagreX.set(n.id, dn ? dn.x : 0);
  }

  const positions: Record<string, { x: number; y: number }> = {};

  for (const lane of lanes) {
    const laneNodes = nodes.filter((n) => n.laneId === lane.id);
    laneNodes.sort((a, b) => (dagreX.get(a.id) ?? 0) - (dagreX.get(b.id) ?? 0));
    laneNodes.forEach((n, idx) => {
      positions[n.id] = {
        x: X_PADDING + idx * X_STEP,
        y: laneYs[lane.id] ?? 0,
      };
    });
  }

  // Any node whose lane isn't in `lanes` (shouldn't happen) — keep current x, snap y to 0.
  for (const n of nodes) {
    if (!positions[n.id]) {
      positions[n.id] = { x: X_PADDING, y: laneYs[n.laneId] ?? 0 };
    }
  }

  return positions;
}
