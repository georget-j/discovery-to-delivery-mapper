import { describe, it, expect } from "vitest";
import { orderStages } from "@/lib/visualisations/stage-order";
import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";

function node(
  id: string,
  laneId: string,
  x: number,
  type: FutureWorkflowNodeType = "ai_agent",
): FutureWorkflowNode {
  return { id, type, laneId, title: id, position: { x, y: 0 } };
}

function mkMap(
  nodes: FutureWorkflowNode[],
  edges: { source: string; target: string }[] = [],
): FutureStateAIWorkflowMap {
  return {
    id: "m1",
    projectId: "p1",
    title: "Test",
    lanes: [],
    nodes,
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      style: "solid",
    })),
    expectedBenefits: [],
    newRisksIntroduced: [],
    assumptions: [],
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

const ids = (ns: FutureWorkflowNode[]) => ns.map((n) => n.id);

describe("orderStages", () => {
  it("returns nodes in topological flow order for a chain", () => {
    const map = mkMap(
      [
        node("a", "lane_human", 0),
        node("b", "lane_ai", 0),
        node("c", "lane_systems", 0),
      ],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    );
    expect(ids(orderStages(map))).toEqual(["a", "b", "c"]);
  });

  it("tie-breaks independent roots by lane reading order", () => {
    const map = mkMap([node("x", "lane_ai", 0), node("y", "lane_human", 0)]);
    expect(ids(orderStages(map))).toEqual(["y", "x"]);
  });

  it("tie-breaks within a lane by x position", () => {
    const map = mkMap([node("a", "lane_ai", 300), node("b", "lane_ai", 0)]);
    expect(ids(orderStages(map))).toEqual(["b", "a"]);
  });

  it("does not hang on a cycle and returns every node", () => {
    const map = mkMap(
      [
        node("a", "lane_human", 0),
        node("b", "lane_ai", 0),
        node("c", "lane_guardrails", 0),
      ],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
        { source: "c", target: "b" }, // cycle b <-> c
      ],
    );
    const out = orderStages(map);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe("a");
  });

  it("handles empty and single-node maps", () => {
    expect(orderStages(mkMap([]))).toEqual([]);
    expect(ids(orderStages(mkMap([node("solo", "lane_ai", 0)])))).toEqual([
      "solo",
    ]);
  });
});
