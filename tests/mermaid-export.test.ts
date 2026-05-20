import { describe, it, expect } from "vitest";
import { currentStateToMermaid, futureStateToMermaid } from "../lib/visualisations/mermaid-export";
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
      const re = new RegExp(`${e.source}\\s+${arrow.replace(/[.>-]/g, (m) => "\\" + m)}.*${e.target}`);
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
    map.nodes[0] = { ...map.nodes[0], title: "Title with [brackets] and (parens)" };
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
