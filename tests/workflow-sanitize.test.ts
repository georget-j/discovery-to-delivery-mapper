import { describe, it, expect } from "vitest";
import {
  sanitizeCurrentStateMap,
  sanitizeFutureStateMap,
  salvageCurrentStateMap,
  salvageFutureStateMap,
  MIN_SALVAGE_NODES,
} from "../lib/visualisations/workflow-sanitize";
import {
  CurrentStateWorkflowMapAIResponseSchema,
  FutureStateAIWorkflowMapAIResponseSchema,
  CurrentStateWorkflowMapSchema,
  type CurrentStateWorkflowMapAIResponse,
  type FutureStateAIWorkflowMapAIResponse,
} from "../lib/visualisations/workflow-types";

// ── Fixtures ───────────────────────────────────────────────────────────────

function currentMapFixture(): CurrentStateWorkflowMapAIResponse {
  return {
    id: "csm_x",
    projectId: "proj_1",
    title: "Test map",
    lanes: [
      { id: "lane_a", title: "A" },
      { id: "lane_b", title: "B" },
    ],
    nodes: [
      {
        id: "n1",
        type: "human_step",
        laneId: "lane_a",
        title: "Step 1",
        position: { x: 0, y: 0 },
      },
      {
        id: "n2",
        type: "system_step",
        laneId: "lane_b",
        title: "Step 2",
        position: { x: 0, y: 0 },
      },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2" }],
    assumptions: [],
    generatedFromSourceIds: [],
  };
}

function futureMapFixture(): FutureStateAIWorkflowMapAIResponse {
  return {
    id: "fsm_x",
    projectId: "proj_1",
    title: "Future map",
    lanes: [{ id: "lane_ai", title: "AI" }],
    nodes: [
      {
        id: "f1",
        type: "ai_assist",
        laneId: "lane_ai",
        title: "Draft",
        sourceCurrentStateNodeIds: ["n1", "ghost"],
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
    expectedBenefits: [],
    newRisksIntroduced: [],
    assumptions: [],
  };
}

// ── AI response schemas (the W1 regression) ────────────────────────────────

describe("AI response schemas", () => {
  it("accept a realistic model payload WITHOUT source/updatedAt (previously every AI map was rejected)", () => {
    const result =
      CurrentStateWorkflowMapAIResponseSchema.safeParse(currentMapFixture());
    expect(result.success).toBe(true);
  });

  it("tolerate a missing or malformed node position instead of rejecting the map", () => {
    const map = currentMapFixture() as unknown as Record<string, unknown>;
    (map.nodes as Record<string, unknown>[])[0].position = undefined;
    (map.nodes as Record<string, unknown>[])[1].position = { x: "left" };
    const result = CurrentStateWorkflowMapAIResponseSchema.safeParse(map);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(result.data.nodes[1].position).toEqual({ x: 0, y: 0 });
    }
  });

  it("tolerate malformed narrative arrays via catch defaults", () => {
    const map = currentMapFixture() as unknown as Record<string, unknown>;
    map.assumptions = "not an array";
    const result = CurrentStateWorkflowMapAIResponseSchema.safeParse(map);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.assumptions).toEqual([]);
  });

  it("a sanitized + stamped map passes the full storage schema", () => {
    const { map } = sanitizeCurrentStateMap(currentMapFixture(), "proj_1");
    const stamped = {
      ...map,
      source: "ai",
      updatedAt: new Date().toISOString(),
      derivedFromHash: "h",
      promptVersion: "2",
    };
    expect(CurrentStateWorkflowMapSchema.safeParse(stamped).success).toBe(true);
  });

  it("future-state schema accepts a payload without source/updatedAt", () => {
    expect(
      FutureStateAIWorkflowMapAIResponseSchema.safeParse(futureMapFixture())
        .success,
    ).toBe(true);
  });
});

// ── sanitize ───────────────────────────────────────────────────────────────

describe("sanitizeCurrentStateMap", () => {
  it("passes a clean map through unchanged", () => {
    const { map, repairs } = sanitizeCurrentStateMap(
      currentMapFixture(),
      "proj_1",
    );
    expect(repairs).toEqual([]);
    expect(map).toEqual(currentMapFixture());
  });

  it("forces the server-side projectId", () => {
    const fixture = { ...currentMapFixture(), projectId: "hallucinated" };
    const { map, repairs } = sanitizeCurrentStateMap(fixture, "proj_1");
    expect(map.projectId).toBe("proj_1");
    expect(repairs.length).toBeGreaterThan(0);
  });

  it("renames duplicate node ids and keeps edges pointing at the first", () => {
    const fixture = currentMapFixture();
    fixture.nodes.push({ ...fixture.nodes[0] });
    const { map, repairs } = sanitizeCurrentStateMap(fixture, "proj_1");
    const ids = map.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("n1_2");
    expect(repairs.some((r) => r.includes("duplicate node id"))).toBe(true);
  });

  it("drops edges with dangling endpoints", () => {
    const fixture = currentMapFixture();
    fixture.edges.push({ id: "e2", source: "n1", target: "missing" });
    const { map, repairs } = sanitizeCurrentStateMap(fixture, "proj_1");
    expect(map.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(repairs.some((r) => r.includes("dangling"))).toBe(true);
  });

  it("remaps unknown lane ids to the first lane", () => {
    const fixture = currentMapFixture();
    fixture.nodes[1].laneId = "lane_ghost";
    const { map } = sanitizeCurrentStateMap(fixture, "proj_1");
    expect(map.nodes[1].laneId).toBe("lane_a");
  });

  it("adds a default lane when none are returned", () => {
    const fixture = { ...currentMapFixture(), lanes: [] };
    const { map, repairs } = sanitizeCurrentStateMap(fixture, "proj_1");
    expect(map.lanes.length).toBe(1);
    expect(map.nodes.every((n) => n.laneId === map.lanes[0].id)).toBe(true);
    expect(repairs.some((r) => r.includes("default lane"))).toBe(true);
  });

  it("dedupes lanes and edge ids", () => {
    const fixture = currentMapFixture();
    fixture.lanes.push({ id: "lane_a", title: "A again" });
    fixture.edges.push({ id: "e1", source: "n2", target: "n1" });
    const { map } = sanitizeCurrentStateMap(fixture, "proj_1");
    expect(map.lanes.filter((l) => l.id === "lane_a").length).toBe(1);
    expect(new Set(map.edges.map((e) => e.id)).size).toBe(map.edges.length);
  });
});

describe("sanitizeFutureStateMap", () => {
  it("clamps sourceCurrentStateNodeIds against the real current-state map", () => {
    const { map, repairs } = sanitizeFutureStateMap(
      futureMapFixture(),
      "proj_1",
      { nodes: [{ id: "n1" }] as never },
    );
    expect(map.nodes[0].sourceCurrentStateNodeIds).toEqual(["n1"]);
    expect(repairs.some((r) => r.includes("current-state"))).toBe(true);
  });

  it("leaves sourceCurrentStateNodeIds alone when no current map is provided", () => {
    const { map } = sanitizeFutureStateMap(futureMapFixture(), "proj_1", null);
    expect(map.nodes[0].sourceCurrentStateNodeIds).toEqual(["n1", "ghost"]);
  });
});

// ── salvage ────────────────────────────────────────────────────────────────

describe("salvage", () => {
  function rawWithBrokenNodes(validCount: number): Record<string, unknown> {
    const valid = Array.from({ length: validCount }, (_, i) => ({
      id: `n${i}`,
      type: "human_step",
      laneId: "lane_a",
      title: `Step ${i}`,
      position: { x: 0, y: 0 },
    }));
    return {
      id: "csm_x",
      projectId: "proj_1",
      title: "Partial map",
      lanes: [{ id: "lane_a", title: "A" }],
      nodes: [
        ...valid,
        { id: "bad", type: "not_a_type", laneId: "lane_a", title: "Broken" },
        "garbage",
      ],
      edges: [
        { id: "e1", source: "n0", target: "n1" },
        { id: "bad_edge", source: 42 },
      ],
      assumptions: [],
      generatedFromSourceIds: [],
    };
  }

  it("keeps valid nodes/edges and drops broken ones when enough survive", () => {
    const salvaged = salvageCurrentStateMap(
      rawWithBrokenNodes(MIN_SALVAGE_NODES),
    );
    expect(salvaged).not.toBeNull();
    expect(salvaged!.nodes.length).toBe(MIN_SALVAGE_NODES);
    expect(salvaged!.edges.length).toBe(1);
  });

  it("returns null when too few valid nodes survive", () => {
    expect(
      salvageCurrentStateMap(rawWithBrokenNodes(MIN_SALVAGE_NODES - 1)),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(salvageCurrentStateMap("nope")).toBeNull();
    expect(salvageCurrentStateMap(null)).toBeNull();
    expect(salvageFutureStateMap([])).toBeNull();
  });
});
