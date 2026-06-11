import { describe, it, expect } from "vitest";
import {
  currentStateToMermaid,
  futureStateToMermaid,
} from "../lib/visualisations/mermaid-export";
import {
  buildCurrentStateWorkflowTemplate,
  buildFutureStateAIWorkflowTemplate,
} from "../lib/visualisations/workflow-templates";
import { listScenarios } from "../lib/scenarios";

const fintech = listScenarios().find((s) => s.id === "fintech-aml")!;

// ── currentStateToMermaid ──────────────────────────────────────────────────

describe("currentStateToMermaid", () => {
  it("starts with 'flowchart LR'", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const out = currentStateToMermaid(map);
    expect(out.split("\n")[0]).toBe("flowchart LR");
  });

  it("emits one 'subgraph ... end' block per lane", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const out = currentStateToMermaid(map);
    const subgraphCount = (out.match(/^\s*subgraph /gm) ?? []).length;
    const endCount = (out.match(/^\s*end$/gm) ?? []).length;
    expect(subgraphCount).toBe(map.lanes.length);
    expect(endCount).toBe(map.lanes.length);
  });

  it("includes every node id in the output", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const out = currentStateToMermaid(map);
    for (const n of map.nodes) {
      expect(out).toContain(n.id);
    }
  });

  it("includes every edge as 'src --> tgt' or 'src -.-> tgt'", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    const out = currentStateToMermaid(map);
    for (const e of map.edges) {
      const arrow = e.style === "dashed" ? "-.->" : "-->";
      // Match e.source ... arrow ... e.target on a single line, allowing optional |label|
      const re = new RegExp(
        `${e.source}\\s+${arrow.replace(/[.>-]/g, (m) => "\\" + m)}.*${e.target}`,
      );
      expect(out).toMatch(re);
    }
  });

  it("escapes quotes inside titles", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    map.nodes[0] = { ...map.nodes[0], title: 'A "quoted" title' };
    const out = currentStateToMermaid(map);
    expect(out).toContain("&quot;");
    expect(out).not.toMatch(/A "quoted" title/);
  });

  it("strips bracket characters from titles to avoid Mermaid parse errors", () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    map.nodes[0] = {
      ...map.nodes[0],
      title: "Title with [brackets] and (parens)",
    };
    const out = currentStateToMermaid(map);
    expect(out).not.toMatch(/\[brackets\]/);
    expect(out).not.toMatch(/\(parens\)/);
  });
});

// ── futureStateToMermaid ───────────────────────────────────────────────────

describe("futureStateToMermaid", () => {
  it("starts with 'flowchart LR'", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const out = futureStateToMermaid(map);
    expect(out.split("\n")[0]).toBe("flowchart LR");
  });

  it("includes every node id", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const out = futureStateToMermaid(map);
    for (const n of map.nodes) {
      expect(out).toContain(n.id);
    }
  });

  it("decorates guardrail nodes with the shield emoji", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const hasGuardrail = map.nodes.some((n) => n.type === "guardrail");
    if (!hasGuardrail) return;
    const out = futureStateToMermaid(map);
    expect(out).toContain("🛡");
  });

  it("renders all 6 lanes for fintech (regulated → guardrails included)", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const out = futureStateToMermaid(map);
    expect(map.lanes.length).toBe(6);
    for (const lane of map.lanes) {
      expect(out).toContain(`subgraph ${lane.id}`);
    }
  });

  it("uses dashed arrow notation for dashed edges", () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    const dashedEdge = map.edges.find((e) => e.style === "dashed");
    if (!dashedEdge) return;
    const out = futureStateToMermaid(map);
    expect(out).toContain("-.->");
  });
});

// ── id sanitisation ────────────────────────────────────────────────────────
// Ids land outside quoted labels, so hostile (AI-generated) ids with
// whitespace or metacharacters must be reduced to bare identifiers and the
// reserved word "end" must be renamed.

describe("id sanitisation", () => {
  const evil = "a b\nclick x callback";

  // The template builders share module-level lane arrays, so copy the
  // arrays before swapping elements to keep tests isolated.
  const cloneCurrent = () => {
    const map = buildCurrentStateWorkflowTemplate(fintech);
    return {
      ...map,
      lanes: [...map.lanes],
      nodes: [...map.nodes],
      edges: [...map.edges],
    };
  };
  const cloneFuture = () => {
    const map = buildFutureStateAIWorkflowTemplate(fintech);
    return {
      ...map,
      lanes: [...map.lanes],
      nodes: [...map.nodes],
      edges: [...map.edges],
    };
  };

  it("sanitises node ids with whitespace/newlines in current-state output", () => {
    const map = cloneCurrent();
    map.nodes[0] = { ...map.nodes[0], id: evil };
    const out = currentStateToMermaid(map);
    expect(out).not.toContain(evil);
    // No line may start with an injected directive.
    expect(out).not.toMatch(/^\s*click /m);
    expect(out).toContain("a_b_click_x_callback");
  });

  it("sanitises edge endpoints in current-state output", () => {
    const map = cloneCurrent();
    map.edges[0] = { ...map.edges[0], source: evil, target: "t;arget" };
    const out = currentStateToMermaid(map);
    expect(out).not.toContain(evil);
    expect(out).not.toContain("t;arget");
    expect(out).toMatch(/a_b_click_x_callback\s+(-->|-\.->)/);
    expect(out).toContain("t_arget");
  });

  it("sanitises lane ids in subgraph headers", () => {
    const map = cloneCurrent();
    map.lanes[0] = { ...map.lanes[0], id: "lane one;init" };
    const out = currentStateToMermaid(map);
    expect(out).toContain("subgraph lane_one_init[");
    expect(out).not.toContain("lane one;init[");
  });

  it("renames the reserved id 'end' to 'end_'", () => {
    const map = cloneCurrent();
    map.nodes[0] = { ...map.nodes[0], id: "end", type: "human_step" };
    map.edges[0] = { ...map.edges[0], source: "end" };
    const out = currentStateToMermaid(map);
    expect(out).toContain('end_("');
    expect(out).toMatch(/end_\s+(-->|-\.->)/);
  });

  it("sanitises ids in future-state output too", () => {
    const map = cloneFuture();
    map.nodes[0] = { ...map.nodes[0], id: evil };
    map.lanes[0] = { ...map.lanes[0], id: "end" };
    const out = futureStateToMermaid(map);
    expect(out).not.toContain(evil);
    expect(out).toContain("a_b_click_x_callback");
    expect(out).toContain("subgraph end_[");
  });
});
