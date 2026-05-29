import { describe, it, expect } from "vitest";
import {
  layoutNodesInLanes,
  nodesOverlap,
} from "../lib/visualisations/auto-layout";
import type { WorkflowLane } from "../lib/visualisations/workflow-types";

const lanes: WorkflowLane[] = [
  { id: "lane_a", title: "A" },
  { id: "lane_b", title: "B" },
];

const laneYs: Record<string, number> = { lane_a: 0, lane_b: 200 };

describe("layoutNodesInLanes", () => {
  it("returns an empty object when there are no nodes", () => {
    expect(layoutNodesInLanes([], [], laneYs, lanes)).toEqual({});
  });

  it("assigns one position per node", () => {
    const nodes = [
      { id: "n1", laneId: "lane_a" },
      { id: "n2", laneId: "lane_b" },
      { id: "n3", laneId: "lane_a" },
    ];
    const positions = layoutNodesInLanes(nodes, [], laneYs, lanes);
    expect(Object.keys(positions).sort()).toEqual(["n1", "n2", "n3"]);
  });

  it("uses the lane's y-coordinate for each node", () => {
    const nodes = [
      { id: "n1", laneId: "lane_a" },
      { id: "n2", laneId: "lane_b" },
    ];
    const positions = layoutNodesInLanes(nodes, [], laneYs, lanes);
    expect(positions.n1.y).toBe(0);
    expect(positions.n2.y).toBe(200);
  });

  it("spaces nodes in the same lane horizontally", () => {
    const nodes = [
      { id: "n1", laneId: "lane_a" },
      { id: "n2", laneId: "lane_a" },
      { id: "n3", laneId: "lane_a" },
    ];
    const positions = layoutNodesInLanes(nodes, [], laneYs, lanes);
    // Three nodes in lane_a should have three distinct x-positions
    const xs = Object.values(positions)
      .map((p) => p.x)
      .sort((a, b) => a - b);
    expect(new Set(xs).size).toBe(3);
    // Step size is 240; first at padding 80
    expect(xs).toEqual([80, 320, 560]);
  });

  it("orders nodes in a lane by topological order from edges", () => {
    const nodes = [
      { id: "first", laneId: "lane_a" },
      { id: "second", laneId: "lane_a" },
      { id: "third", laneId: "lane_a" },
    ];
    // Edges declare second → third, first → second
    // Expected order in lane_a: first, second, third
    const edges = [
      { source: "first", target: "second" },
      { source: "second", target: "third" },
    ];
    const positions = layoutNodesInLanes(nodes, edges, laneYs, lanes);
    expect(positions.first.x).toBeLessThan(positions.second.x);
    expect(positions.second.x).toBeLessThan(positions.third.x);
  });

  it("ignores edges that reference unknown nodes (does not throw)", () => {
    const nodes = [{ id: "n1", laneId: "lane_a" }];
    const edges = [{ source: "n1", target: "unknown" }];
    expect(() => layoutNodesInLanes(nodes, edges, laneYs, lanes)).not.toThrow();
  });

  it("snaps an unrecognised lane id to y=0 by default", () => {
    const nodes = [{ id: "orphan", laneId: "lane_missing" }];
    const positions = layoutNodesInLanes(nodes, [], laneYs, lanes);
    expect(positions.orphan.y).toBe(0);
  });

  it("never overlaps nodes, even with several agents + validators per lane", () => {
    // Orchestrator + two agents share lane_a; two validators share lane_b.
    const nodes = [
      { id: "orch", laneId: "lane_a" },
      { id: "a1", laneId: "lane_a" },
      { id: "a2", laneId: "lane_a" },
      { id: "v1", laneId: "lane_b" },
      { id: "v2", laneId: "lane_b" },
    ];
    const edges = [
      { source: "orch", target: "a1" },
      { source: "orch", target: "a2" },
      { source: "a1", target: "v1" },
      { source: "a2", target: "v2" },
    ];
    const positions = layoutNodesInLanes(nodes, edges, laneYs, lanes);
    const placed = nodes.map((n) => ({ position: positions[n.id] }));
    expect(nodesOverlap(placed)).toBe(false);
    // The three lane_a nodes occupy three distinct columns.
    const aiXs = ["orch", "a1", "a2"].map((id) => positions[id].x);
    expect(new Set(aiXs).size).toBe(3);
  });
});

describe("nodesOverlap", () => {
  it("detects two nodes stacked on top of each other", () => {
    expect(
      nodesOverlap([
        { position: { x: 100, y: 100 } },
        { position: { x: 110, y: 110 } },
      ]),
    ).toBe(true);
  });

  it("returns false for well-separated nodes", () => {
    expect(
      nodesOverlap([
        { position: { x: 0, y: 0 } },
        { position: { x: 400, y: 0 } },
        { position: { x: 0, y: 300 } },
      ]),
    ).toBe(false);
  });
});
