import { describe, it, expect } from "vitest";
import { listScenarios } from "../lib/scenarios";
import {
  buildCurrentStateWorkflowTemplate,
  buildFutureStateAIWorkflowTemplate,
} from "../lib/visualisations/workflow-templates";
import {
  CurrentStateWorkflowMapSchema,
  FutureStateAIWorkflowMapSchema,
} from "../lib/visualisations/workflow-types";
import { hashWorkflows } from "../lib/visualisations/workflow-helpers";
import type { OnboardingProject } from "../lib/types";

const scenarios = listScenarios();
const fintech = scenarios.find((s) => s.id === "fintech-aml")!;

// ── Current-state template ─────────────────────────────────────────────────

describe("buildCurrentStateWorkflowTemplate", () => {
  it("produces a Zod-valid current-state map", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const result = CurrentStateWorkflowMapSchema.safeParse(map);
    if (!result.success) console.error(result.error);
    expect(result.success).toBe(true);
  });

  it("stamps the input hash on derivedFromHash", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    expect(map.derivedFromHash).toBe(hashWorkflows(fintech.workflows));
  });

  it("uses the 4 default lanes", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const laneIds = map.lanes.map((l) => l.id).sort();
    expect(laneIds).toEqual(["lane_compliance", "lane_notes", "lane_operator", "lane_systems"]);
  });

  it("every node belongs to a declared lane", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const laneIds = new Set(map.lanes.map((l) => l.id));
    for (const node of map.nodes) {
      expect(laneIds).toContain(node.laneId);
    }
  });

  it("every edge references valid node ids", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const nodeIds = new Set(map.nodes.map((n) => n.id));
    for (const edge of map.edges) {
      expect(nodeIds).toContain(edge.source);
      expect(nodeIds).toContain(edge.target);
    }
  });

  it("source is 'template_fallback'", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    expect(map.source).toBe("template_fallback");
  });
});

// ── Future-state template ──────────────────────────────────────────────────

describe("buildFutureStateAIWorkflowTemplate", () => {
  it("produces a Zod-valid future-state map", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const result = FutureStateAIWorkflowMapSchema.safeParse(map);
    if (!result.success) console.error(result.error);
    expect(result.success).toBe(true);
  });

  it("stamps the input hash on derivedFromHash", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    expect(map.derivedFromHash).toBe(hashWorkflows(fintech.workflows));
  });

  it("uses the 6 default lanes including guardrails + monitoring", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const laneIds = map.lanes.map((l) => l.id).sort();
    expect(laneIds).toEqual([
      "lane_ai", "lane_compliance", "lane_guardrails",
      "lane_human", "lane_monitoring", "lane_systems",
    ]);
  });

  it("includes at least one audit_log and one monitoring node", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    expect(map.nodes.some((n) => n.type === "audit_log")).toBe(true);
    expect(map.nodes.some((n) => n.type === "monitoring")).toBe(true);
  });

  it("for regulated industries, includes a guardrail node", () => {
    // fintech-aml seed has regulatoryContext set
    expect(fintech.customer.regulatoryContext.length).toBeGreaterThan(0);
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    expect(map.nodes.some((n) => n.type === "guardrail")).toBe(true);
  });

  it("expectedBenefits and newRisksIntroduced are non-empty", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    expect(map.expectedBenefits.length).toBeGreaterThan(0);
    expect(map.newRisksIntroduced.length).toBeGreaterThan(0);
  });

  it("if a currentStateMapId is passed, basedOnCurrentStateMapId is set", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech, "csm_test_123");
    expect(map.basedOnCurrentStateMapId).toBe("csm_test_123");
  });
});

// ── Cross-scenario coverage ────────────────────────────────────────────────

describe("workflow templates across all seeded scenarios", () => {
  it.each(scenarios.map((s) => [s.id, s] as [string, OnboardingProject]))(
    "current-state template is Zod-valid for %s",
    (_id, scenario) => {
      const map = buildCurrentStateWorkflowTemplate(scenario);
      const result = CurrentStateWorkflowMapSchema.safeParse(map);
      expect(result.success).toBe(true);
    }
  );

  it.each(scenarios.map((s) => [s.id, s] as [string, OnboardingProject]))(
    "future-state template is Zod-valid for %s",
    (_id, scenario) => {
      const map = buildFutureStateAIWorkflowTemplate(scenario);
      const result = FutureStateAIWorkflowMapSchema.safeParse(map);
      expect(result.success).toBe(true);
    }
  );
});

// ── hashWorkflows helper ───────────────────────────────────────────────────

describe("hashWorkflows", () => {
  it("is stable across identical inputs", () => {
    const h1 = hashWorkflows(fintech.workflows);
    const h2 = hashWorkflows(fintech.workflows);
    expect(h1).toBe(h2);
  });

  it("changes when a workflow name changes", () => {
    const h1 = hashWorkflows(fintech.workflows);
    const modified = fintech.workflows.map((w, i) => (i === 0 ? { ...w, name: "Renamed step" } : w));
    const h2 = hashWorkflows(modified);
    expect(h1).not.toBe(h2);
  });

  it("changes when futureState changes", () => {
    const h1 = hashWorkflows(fintech.workflows);
    // Pick a value different from whatever the first workflow already has
    const current = fintech.workflows[0].futureState;
    const next: "human_led" | "ai_assisted" = current === "human_led" ? "ai_assisted" : "human_led";
    const modified = fintech.workflows.map((w, i) => (i === 0 ? { ...w, futureState: next } : w));
    const h2 = hashWorkflows(modified);
    expect(h1).not.toBe(h2);
  });

  it("returns empty string for empty workflows", () => {
    expect(hashWorkflows([])).toBe("");
  });

  it("changes when a workflow description changes", () => {
    const h1 = hashWorkflows(fintech.workflows);
    const modified = fintech.workflows.map((w, i) =>
      i === 0 ? { ...w, description: "Reworded description" } : w,
    );
    expect(hashWorkflows(modified)).not.toBe(h1);
  });

  it("changes when a pain point is added", () => {
    const h1 = hashWorkflows(fintech.workflows);
    const modified = fintech.workflows.map((w, i) =>
      i === 0 ? { ...w, painPoints: [...w.painPoints, "New pain"] } : w,
    );
    expect(hashWorkflows(modified)).not.toBe(h1);
  });
});
