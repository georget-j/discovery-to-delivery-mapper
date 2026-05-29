import { describe, it, expect } from "vitest";
import {
  detectFindings,
  mergeNodes,
  removeNodes,
  applyReview,
  mergeFindings,
  type ReviewFinding,
} from "@/lib/visualisations/workflow-review";
import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";

function node(
  id: string,
  type: FutureWorkflowNodeType,
  title: string,
  extra: Partial<FutureWorkflowNode> = {},
): FutureWorkflowNode {
  return {
    id,
    type,
    laneId: "lane_ai",
    title,
    position: { x: 0, y: 0 },
    ...extra,
  };
}

function mkMap(
  nodes: FutureWorkflowNode[],
  edges: { source: string; target: string; label?: string }[] = [],
): FutureStateAIWorkflowMap {
  return {
    id: "m1",
    projectId: "p1",
    title: "Test map",
    lanes: [],
    nodes,
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      style: "solid",
    })),
    expectedBenefits: [],
    newRisksIntroduced: [],
    assumptions: [],
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

describe("detectFindings — orphans", () => {
  it("flags a node with no edges when the map is otherwise connected", () => {
    const map = mkMap(
      [
        node("a", "human_action", "Intake"),
        node("b", "ai_agent", "Draft"),
        node("orphan", "system_action", "Stray export"),
      ],
      [{ source: "a", target: "b" }],
    );
    const orphans = detectFindings(map).filter((f) => f.kind === "orphan");
    expect(orphans).toHaveLength(1);
    expect(orphans[0].nodeIds).toEqual(["orphan"]);
    expect(orphans[0].defaultAction).toBe("remove");
  });

  it("does not flag orphans when the map has no edges yet", () => {
    const map = mkMap([
      node("a", "human_action", "One"),
      node("b", "ai_agent", "Two"),
    ]);
    expect(detectFindings(map).some((f) => f.kind === "orphan")).toBe(false);
  });
});

describe("detectFindings — duplicates", () => {
  it("flags two same-type nodes with near-identical titles", () => {
    const map = mkMap([
      node("d1", "ai_agent", "AML triage agent"),
      node("d2", "ai_agent", "AML triage agent (copy)"),
    ]);
    const dup = detectFindings(map).filter((f) => f.kind === "duplicate");
    expect(dup).toHaveLength(1);
    expect(new Set(dup[0].nodeIds)).toEqual(new Set(["d1", "d2"]));
    expect(dup[0].defaultAction).toBe("merge");
  });

  it("does not flag genuinely different agents", () => {
    const map = mkMap([
      node("a", "ai_agent", "AML triage agent"),
      node("b", "ai_agent", "SAR drafting bot"),
    ]);
    expect(detectFindings(map).some((f) => f.kind === "duplicate")).toBe(false);
  });
});

describe("detectFindings — redundant layers", () => {
  it("flags more than one monitoring node", () => {
    const map = mkMap([
      node("m1", "monitoring", "Quality monitoring", {
        laneId: "lane_monitoring",
      }),
      node("m2", "monitoring", "Drift telemetry", {
        laneId: "lane_monitoring",
      }),
    ]);
    const red = detectFindings(map).filter((f) => f.kind === "redundant");
    expect(red).toHaveLength(1);
    expect(new Set(red[0].nodeIds)).toEqual(new Set(["m1", "m2"]));
  });
});

describe("mergeNodes", () => {
  it("rewires edges onto the survivor and drops self-loops + duplicates", () => {
    const map = mkMap(
      [
        node("a", "ai_agent", "Keep"),
        node("b", "ai_agent", "Drop"),
        node("c", "guardrail", "Validator", { laneId: "lane_guardrails" }),
        node("x", "human_action", "Source"),
      ],
      [
        { source: "a", target: "b" }, // becomes self-loop → dropped
        { source: "b", target: "c" }, // becomes a → c
        { source: "x", target: "b" }, // becomes x → a
      ],
    );
    const next = mergeNodes(map, "a", ["b"]);
    expect(next.nodes.find((n) => n.id === "b")).toBeUndefined();
    const pairs = next.edges.map((e) => `${e.source}→${e.target}`).sort();
    expect(pairs).toEqual(["a→c", "x→a"]);
  });

  it("unions array fields onto the survivor", () => {
    const map = mkMap(
      [
        node("a", "ai_agent", "Keep", { guardrails: ["g1"] }),
        node("b", "ai_agent", "Drop", { guardrails: ["g2"] }),
      ],
      [{ source: "a", target: "b" }],
    );
    const keep = mergeNodes(map, "a", ["b"]).nodes.find((n) => n.id === "a")!;
    expect(new Set(keep.guardrails)).toEqual(new Set(["g1", "g2"]));
  });
});

describe("removeNodes", () => {
  it("removes nodes and every incident edge", () => {
    const map = mkMap(
      [
        node("a", "human_action", "A"),
        node("b", "ai_agent", "B"),
        node("c", "guardrail", "C", { laneId: "lane_guardrails" }),
      ],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    );
    const next = removeNodes(map, ["b"]);
    expect(next.nodes.map((n) => n.id).sort()).toEqual(["a", "c"]);
    expect(next.edges).toHaveLength(0);
  });
});

describe("applyReview", () => {
  it("applies merge + remove + keep decisions and skips vanished nodes", () => {
    const map = mkMap(
      [
        node("d1", "ai_agent", "Dup A"),
        node("d2", "ai_agent", "Dup B"),
        node("orphan", "system_action", "Stray"),
        node("k", "human_action", "Keep me"),
      ],
      [{ source: "d1", target: "k" }],
    );
    const decisions: {
      finding: ReviewFinding;
      action: "merge" | "remove" | "keep";
    }[] = [
      {
        finding: {
          id: "dup",
          kind: "duplicate",
          nodeIds: ["d1", "d2"],
          title: "",
          reason: "",
          defaultAction: "merge",
          keepId: "d1",
          source: "rule",
        },
        action: "merge",
      },
      {
        finding: {
          id: "orphan",
          kind: "orphan",
          nodeIds: ["orphan"],
          title: "",
          reason: "",
          defaultAction: "remove",
          source: "rule",
        },
        action: "remove",
      },
      {
        finding: {
          id: "keepfinding",
          kind: "duplicate",
          nodeIds: ["k"],
          title: "",
          reason: "",
          defaultAction: "merge",
          source: "rule",
        },
        action: "keep",
      },
    ];
    const next = applyReview(map, decisions);
    expect(next.nodes.map((n) => n.id).sort()).toEqual(["d1", "k"]);
  });
});

describe("mergeFindings", () => {
  it("dedupes AI findings that cover the same node set (rule wins)", () => {
    const rule: ReviewFinding[] = [
      {
        id: "r1",
        kind: "duplicate",
        nodeIds: ["a", "b"],
        title: "rule",
        reason: "",
        defaultAction: "merge",
        source: "rule",
      },
    ];
    const ai: ReviewFinding[] = [
      {
        id: "a1",
        kind: "duplicate",
        nodeIds: ["b", "a"],
        title: "ai dup",
        reason: "",
        defaultAction: "merge",
        source: "ai",
      },
      {
        id: "a2",
        kind: "misplaced",
        nodeIds: ["c"],
        title: "ai new",
        reason: "",
        defaultAction: "remove",
        source: "ai",
      },
    ];
    const merged = mergeFindings(rule, ai);
    expect(merged.map((f) => f.id).sort()).toEqual(["a2", "r1"]);
  });
});
