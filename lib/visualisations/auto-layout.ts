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

// Cheap overlap check used to auto-heal maps generated under older (tighter)
// lane spacing. Treats nodes as ~200×140 boxes; returns true if any two
// intersect. A tidied layout (X_STEP=240, lane pitch 160) never trips this,
// so the heal converges in one pass.
export function nodesOverlap(
  nodes: { position: { x: number; y: number } }[],
): boolean {
  const W = 200;
  const H = 140;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      if (Math.abs(a.x - b.x) < W && Math.abs(a.y - b.y) < H) return true;
    }
  }
  return false;
}

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

  for (const n of nodes)
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target))
      g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  // Quantise dagre's x into GLOBAL column ranks so the whole graph flows
  // left→right consistently (a node and the validator it feeds line up across
  // lanes, instead of each lane restarting its own x-order — which produced
  // backward, crossing edges).
  const dagreX = new Map<string, number>();
  for (const n of nodes) {
    const dn = g.node(n.id);
    dagreX.set(n.id, dn ? dn.x : 0);
  }
  const uniqueXs = Array.from(new Set([...dagreX.values()])).sort(
    (a, b) => a - b,
  );
  const colOf = (id: string) => uniqueXs.indexOf(dagreX.get(id) ?? 0);

  const positions: Record<string, { x: number; y: number }> = {};

  // Place each lane's nodes on their global column, bumping to the next free
  // column when two nodes in the same lane share one (so they never overlap).
  const placeLane = (laneId: string, laneNodes: N[]) => {
    const used = new Set<number>();
    for (const n of [...laneNodes].sort((a, b) => colOf(a.id) - colOf(b.id))) {
      let col = Math.max(0, colOf(n.id));
      while (used.has(col)) col++;
      used.add(col);
      positions[n.id] = {
        x: X_PADDING + col * X_STEP,
        y: laneYs[laneId] ?? 0,
      };
    }
  };

  for (const lane of lanes) {
    placeLane(
      lane.id,
      nodes.filter((n) => n.laneId === lane.id),
    );
  }
  // Nodes in a lane not listed in `lanes` (shouldn't happen) — place anyway.
  const placedLanes = new Set(lanes.map((l) => l.id));
  const orphanLanes = new Set(
    nodes.filter((n) => !placedLanes.has(n.laneId)).map((n) => n.laneId),
  );
  for (const laneId of orphanLanes) {
    placeLane(
      laneId,
      nodes.filter((n) => n.laneId === laneId),
    );
  }

  return positions;
}
