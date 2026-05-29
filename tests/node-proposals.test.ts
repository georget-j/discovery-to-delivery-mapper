import { describe, it, expect } from "vitest";
import {
  proposeForNode,
  proposeForMap,
  proposeWorkflowBlueprints,
  isSolutionImplemented,
  moveToProposal,
  type MapMove,
} from "@/lib/visualisations/node-proposals";
import { SOLUTION_BY_ID } from "@/lib/patterns/solution-library";
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

describe("data-flow edge labels", () => {
  it("the add-validator rule labels the source→validator edge", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const map = mkMap([ai]);
    const p = proposeForNode(ai, map, project()).find(
      (x) => x.id === "a:add-validator",
    )!;
    expect(p.insert.connectFromSourceLabel).toBe("draft output");
  });

  it("blueprint internal edges carry data-flow labels", () => {
    const map = mkMap([node("a", "human_action"), node("b", "system_action")]);
    const pipeline = proposeWorkflowBlueprints(map, project()).find(
      (x) => x.id === "blueprint:orchestrator-workers",
    )!;
    expect((pipeline.insert.internalEdges ?? []).every((e) => !!e.label)).toBe(
      true,
    );
  });

  it("buildProposalAdditions stamps labels onto created edges", () => {
    const ai = node("a", "ai_agent", { laneId: "lane_ai" });
    const map = mkMap([ai]);
    const p = proposeForNode(ai, map, project()).find(
      (x) => x.id === "a:add-validator",
    )!;
    const { edges } = buildProposalAdditions(map, p, "a");
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe("draft output");
  });
});

describe("moveToProposal (map-aware AI)", () => {
  const move: MapMove = {
    id: "m1",
    sourceNodeId: "stage-3",
    patternFamily: "agent_with_validator",
    title: "Add a validator agent",
    rationale: "Verify dispositions before they commit.",
    insert: {
      nodes: [
        {
          key: "v",
          type: "guardrail",
          laneId: "lane_guardrails",
          title: "Validator agent",
          description: "Second-look check.",
        },
      ],
      connectFromSource: true,
      connectFromSourceLabel: "draft disposition",
      connectToExisting: [
        { fromKey: "v", toNodeId: "stage-4", label: "verified" },
      ],
    },
  };

  it("carries the anchor stage as preferredSourceNodeId", () => {
    expect(moveToProposal(move).preferredSourceNodeId).toBe("stage-3");
  });

  it("preserves the source + back-connection labels", () => {
    const p = moveToProposal(move);
    expect(p.insert.connectFromSource).toBe(true);
    expect(p.insert.connectFromSourceLabel).toBe("draft disposition");
    expect(p.insert.connectToExisting?.[0]).toMatchObject({
      fromKey: "v",
      toNodeId: "stage-4",
      label: "verified",
    });
  });

  it("wires the move's node onto the anchored stage via buildProposalAdditions", () => {
    const stage3 = node("stage-3", "ai_agent", { laneId: "lane_ai" });
    const stage4 = node("stage-4", "human_action");
    const map = mkMap([stage3, stage4]);
    const p = moveToProposal(move);
    const { nodes, edges } = buildProposalAdditions(
      map,
      p,
      p.preferredSourceNodeId ?? null,
    );
    expect(nodes).toHaveLength(1);
    // source→validator + validator→existing stage-4 = 2 edges, both labeled.
    const srcEdge = edges.find((e) => e.source === "stage-3");
    const backEdge = edges.find((e) => e.target === "stage-4");
    expect(srcEdge?.label).toBe("draft disposition");
    expect(backEdge?.label).toBe("verified");
  });
});

describe("isSolutionImplemented (suggestion dedup)", () => {
  it("is false for a fresh single-step map", () => {
    const map = mkMap([node("a", "human_action")]);
    expect(
      isSolutionImplemented(SOLUTION_BY_ID["orchestrator-workers"], map),
    ).toBe(false);
  });

  it("is true once the map has orchestrator + agents + validator + monitoring", () => {
    const map = mkMap([
      node("o", "ai_agent", { laneId: "lane_ai", title: "Orchestrator agent" }),
      node("a1", "ai_agent", { laneId: "lane_ai", title: "Specialist A" }),
      node("a2", "ai_agent", { laneId: "lane_ai", title: "Specialist B" }),
      node("v", "guardrail", { laneId: "lane_guardrails", title: "Validator" }),
      node("m", "monitoring", {
        laneId: "lane_monitoring",
        title: "Monitoring",
      }),
    ]);
    expect(
      isSolutionImplemented(SOLUTION_BY_ID["orchestrator-workers"], map),
    ).toBe(true);
  });

  it("treats evaluator-optimizer as implemented once a validator exists", () => {
    const map = mkMap([
      node("a", "ai_agent", { laneId: "lane_ai" }),
      node("v", "guardrail", { laneId: "lane_guardrails", title: "Validator" }),
    ]);
    expect(
      isSolutionImplemented(SOLUTION_BY_ID["evaluator-optimizer"], map),
    ).toBe(true);
  });

  it("never auto-suppresses a pattern with no distinctive capability (routing)", () => {
    const map = mkMap([
      node("a", "ai_agent", { laneId: "lane_ai" }),
      node("v", "guardrail", { laneId: "lane_guardrails" }),
      node("m", "monitoring", { laneId: "lane_monitoring" }),
    ]);
    expect(isSolutionImplemented(SOLUTION_BY_ID["routing"], map)).toBe(false);
  });

  it("proposeWorkflowBlueprints drops solutions already implemented", () => {
    const map = mkMap([
      node("o", "ai_agent", { laneId: "lane_ai", title: "Orchestrator agent" }),
      node("a1", "ai_agent", { laneId: "lane_ai", title: "Specialist A" }),
      node("a2", "ai_agent", { laneId: "lane_ai", title: "Specialist B" }),
      node("v", "guardrail", { laneId: "lane_guardrails", title: "Validator" }),
      node("m", "monitoring", {
        laneId: "lane_monitoring",
        title: "Monitoring",
      }),
    ]);
    const ids = proposeWorkflowBlueprints(map, project()).map((p) => p.id);
    expect(ids).not.toContain("blueprint:orchestrator-workers");
    expect(ids).not.toContain("blueprint:evaluator-optimizer");
  });
});
