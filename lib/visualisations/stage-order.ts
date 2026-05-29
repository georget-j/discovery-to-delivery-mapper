// Orders the nodes of a future-state map into a "stage sequence" the guided
// walkthrough steps through. Topological order from the edges (so you walk the
// flow front-to-back), tie-broken by lane then x so parallel branches and
// disconnected nodes still come out in a sensible reading order. Cycles (e.g.
// an evaluator→optimizer loop) don't break it — any nodes left in a cycle are
// appended in lane/x order.

import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
} from "@/lib/visualisations/workflow-types";

// Reading order of the swimlanes, top to bottom.
const LANE_RANK: Record<string, number> = {
  lane_human: 0,
  lane_ai: 1,
  lane_systems: 2,
  lane_guardrails: 3,
  lane_compliance: 4,
  lane_monitoring: 5,
};

function laneRank(laneId: string): number {
  return LANE_RANK[laneId] ?? 99;
}

export function orderStages(
  map: FutureStateAIWorkflowMap,
): FutureWorkflowNode[] {
  const nodes = map.nodes;
  if (nodes.length <= 1) return [...nodes];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of map.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    if (e.source === e.target) continue;
    adj.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  // Stable comparator: lane reading order, then x, then id.
  const better = (a: string, b: string): boolean => {
    const na = byId.get(a)!;
    const nb = byId.get(b)!;
    const ra = laneRank(na.laneId);
    const rb = laneRank(nb.laneId);
    if (ra !== rb) return ra < rb;
    if (na.position.x !== nb.position.x) return na.position.x < nb.position.x;
    return a < b;
  };

  const ordered: FutureWorkflowNode[] = [];
  const visited = new Set<string>();
  const remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    // Pick the best available node with indegree 0; if none (a cycle), pick the
    // best remaining node outright so we always make progress.
    let pick: string | null = null;
    for (const id of remaining) {
      if ((indegree.get(id) ?? 0) === 0 && (pick === null || better(id, pick)))
        pick = id;
    }
    if (pick === null) {
      for (const id of remaining)
        if (pick === null || better(id, pick)) pick = id;
    }
    const chosen = pick!;
    remaining.delete(chosen);
    visited.add(chosen);
    ordered.push(byId.get(chosen)!);
    for (const t of adj.get(chosen) ?? []) {
      if (!visited.has(t)) indegree.set(t, (indegree.get(t) ?? 1) - 1);
    }
  }

  return ordered;
}
