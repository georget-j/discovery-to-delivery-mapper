import { describe, it, expect } from "vitest";
import {
  proposeForNode,
  proposeForMap,
  proposeWorkflowBlueprints,
} from "@/lib/visualisations/node-proposals";
import { buildProposalAdditions } from "@/components/visualisations/future-state-workflow/futureWorkflowUtils";
import { createBlankProject } from "@/lib/project-store";
import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import type { OnboardingProject } from "@/lib/types";

function node(
  id: string,
  type: FutureWorkflowNodeType,
  extra: Partial<FutureWorkflowNode> = {},
): FutureWorkflowNode {
  return {
    id,
    type,
    laneId: "lane_human",
    title: `${type} ${id}`,
    position: { x: 0, y: 0 },
    ...extra,
  };
}

function mkMap(
  nodes: FutureWorkflowNode[],
  edges: { source: string; target: string }[] = [],
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
      style: "solid",
    })),
    expectedBenefits: [],
    newRisksIntroduced: [],
    assumptions: [],
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

// Project with no regulatory context unless overridden.
function project(regulatory: string[] = []): OnboardingProject {
  const p = createBlankProject("Test Co");
  p.customer.regulatoryContext = regulatory;
  return p;
}

describe("proposeForNode", () => {
  it("proposes an AI agent for a manual step with no AI downstream", () => {
    const n = node("a", "human_action");
    const map = mkMap([n]);
    const ids = proposeForNode(n, map, project()).map((p) => p.id);
    expect(ids).toContain("a:add-agent");
  });

  it("does NOT propose an AI agent when an AI node is already downstream", () => {
    const human = node("a", "human_action");
    const ai = node("b", "ai_agent", { laneId: "lane_ai" });
    const map = mkMap([human, ai], [{ source: "a", target: "b" }]);
    const ids = proposeForNode(human, map, project()).map((p) => p.id);
    expect(ids).not.toContain("a:add-agent");
  });

  it("proposes a validator when an AI node has no guardrail downstream", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const map = mkMap([ai]);
    const ids = proposeForNode(ai, map, project()).map((p) => p.id);
    expect(ids).toContain("a:add-validator");
  });

  it("does NOT propose a validator when a guardrail is already downstream", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const g = node("b", "guardrail", { laneId: "lane_guardrails" });
    const map = mkMap([ai, g], [{ source: "a", target: "b" }]);
    const ids = proposeForNode(ai, map, project()).map((p) => p.id);
    expect(ids).not.toContain("a:add-validator");
  });

  it("proposes monitoring when an AI node exists and the map has none", () => {
    const ai = node("a", "ai_assist", { laneId: "lane_ai" });
    const map = mkMap([ai]);
    const ids = proposeForNode(ai, map, project()).map((p) => p.id);
    expect(ids).toContain("a:add-monitoring");
  });

  it("proposes an approval gate only when the project is regulated", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const map = mkMap([ai]);
    const regulated = proposeForNode(ai, map, project(["GDPR"])).map(
      (p) => p.id,
    );
    const unregulated = proposeForNode(ai, map, project()).map((p) => p.id);
    expect(regulated).toContain("a:add-approval");
    expect(unregulated).not.toContain("a:add-approval");
  });

  it("each proposal carries a pattern family and at least one node to insert", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const map = mkMap([ai]);
    for (const p of proposeForNode(ai, map, project(["GDPR"]))) {
      expect(p.patternFamily).toBeTruthy();
      expect(p.insert.nodes.length).toBeGreaterThan(0);
    }
  });
});

describe("proposeForMap", () => {
  it("surfaces a map-level guardrail gap when AI exists with no guardrails", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const groups = proposeForMap(mkMap([ai]), project());
    const mapGroup = groups.find((g) => g.nodeId === null);
    expect(mapGroup?.proposals.map((p) => p.id)).toContain(
      "map:guardrail-layer",
    );
  });

  it("does not double-report monitoring at both map and node level", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const groups = proposeForMap(mkMap([ai]), project());
    const perNodeMonitoring = groups
      .filter((g) => g.nodeId !== null)
      .flatMap((g) => g.proposals)
      .filter((p) => p.id.endsWith(":add-monitoring"));
    expect(perNodeMonitoring).toHaveLength(0);
  });

  it("returns no groups for an empty map", () => {
    expect(proposeForMap(mkMap([]), project())).toEqual([]);
  });
});

describe("proposeWorkflowBlueprints", () => {
  it("offers core market solutions as blueprints for a multi-step map", () => {
    const map = mkMap([node("a", "human_action"), node("b", "system_action")]);
    const ids = proposeWorkflowBlueprints(map, project()).map((p) => p.id);
    expect(ids).toContain("blueprint:orchestrator-workers");
    expect(ids).toContain("blueprint:evaluator-optimizer");
  });

  it("blueprints are workflow-scoped and carry internal edges", () => {
    const map = mkMap([node("a", "human_action"), node("b", "system_action")]);
    const pipeline = proposeWorkflowBlueprints(map, project()).find(
      (p) => p.id === "blueprint:orchestrator-workers",
    )!;
    expect(pipeline.scope).toBe("workflow");
    expect(pipeline.insert.nodes.length).toBeGreaterThanOrEqual(5);
    expect((pipeline.insert.internalEdges ?? []).length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it("offers RAG solutions only when the customer has documents/data", () => {
    const map = mkMap([node("a", "ai_agent", { laneId: "lane_ai" })]);
    const withoutData = proposeWorkflowBlueprints(map, project()).map(
      (p) => p.id,
    );
    expect(withoutData.some((id) => id.startsWith("blueprint:rag-"))).toBe(
      false,
    );

    const p = project();
    p.dataSources = [
      {
        id: "d1",
        name: "Policy docs",
        sourceSystem: "",
        dataType: "documents",
        format: "pdf",
        quality: "good",
        volumeEstimate: "",
        updateFrequency: "",
        pii: "unknown",
        accessStatus: "available",
        openQuestions: [],
      },
    ];
    const withData = proposeWorkflowBlueprints(map, p).map((x) => x.id);
    expect(withData.some((id) => id.startsWith("blueprint:rag-"))).toBe(true);
  });

  it("surfaces blueprints at the top of proposeForMap's map group", () => {
    const map = mkMap([node("a", "human_action"), node("b", "system_action")]);
    const groups = proposeForMap(map, project());
    const mapGroup = groups.find((g) => g.nodeId === null)!;
    expect(mapGroup.proposals[0].scope).toBe("workflow");
  });
});

describe("buildProposalAdditions (blueprints)", () => {
  it("wires internal edges by key for a blueprint", () => {
    const map = mkMap([node("a", "human_action"), node("b", "system_action")]);
    const pipeline = proposeWorkflowBlueprints(map, project()).find(
      (p) => p.id === "blueprint:orchestrator-workers",
    )!;
    const { nodes, edges } = buildProposalAdditions(map, pipeline, null);
    expect(nodes).toHaveLength(pipeline.insert.nodes.length);
    // 6 internal edges, no source connection (connectFromSource false).
    expect(edges).toHaveLength(pipeline.insert.internalEdges!.length);
    // Every edge references an inserted node id.
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });
});
