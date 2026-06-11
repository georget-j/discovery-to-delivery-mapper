import { describe, it, expect } from "vitest";
import {
  CURRENT_STATE_MAP_JSON_SCHEMA,
  FUTURE_STATE_MAP_JSON_SCHEMA,
  WORKFLOW_NODE_TYPE_VALUES,
  FUTURE_NODE_TYPE_VALUES,
  AUTOMATION_LEVEL_VALUES,
} from "../lib/visualisations/workflow-json-schemas";
import {
  CurrentStateWorkflowMapAIResponseSchema,
  FutureStateAIWorkflowMapAIResponseSchema,
} from "../lib/visualisations/workflow-types";
import { stripNulls } from "../lib/llm/generate-json";

// OpenAI strict structured outputs reject schemas where any object property
// is missing from `required` or lacks additionalProperties: false. Walk the
// schema and enforce both invariants so a hand-edit can't silently break
// strict mode at runtime.
function checkStrictInvariants(schema: unknown, path = "root"): string[] {
  const problems: string[] = [];
  if (!schema || typeof schema !== "object") return problems;
  const s = schema as Record<string, unknown>;

  const type = s.type;
  const isObjectType =
    type === "object" || (Array.isArray(type) && type.includes("object"));
  if (isObjectType) {
    if (s.additionalProperties !== false) {
      problems.push(`${path}: additionalProperties must be false`);
    }
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = (s.required ?? []) as string[];
    const propKeys = Object.keys(props).sort();
    const reqKeys = [...required].sort();
    if (JSON.stringify(propKeys) !== JSON.stringify(reqKeys)) {
      problems.push(
        `${path}: required [${reqKeys}] != properties [${propKeys}]`,
      );
    }
    for (const [k, v] of Object.entries(props)) {
      problems.push(...checkStrictInvariants(v, `${path}.${k}`));
    }
  }
  if (s.items) problems.push(...checkStrictInvariants(s.items, `${path}[]`));
  return problems;
}

describe("strict JSON schemas", () => {
  it("current-state schema satisfies strict-mode invariants", () => {
    expect(checkStrictInvariants(CURRENT_STATE_MAP_JSON_SCHEMA)).toEqual([]);
  });

  it("future-state schema satisfies strict-mode invariants", () => {
    expect(checkStrictInvariants(FUTURE_STATE_MAP_JSON_SCHEMA)).toEqual([]);
  });

  it("node type enums agree with the Zod schemas", () => {
    // Parse a node of each enum value through the Zod AI schema — every JSON
    // schema enum value must be accepted, or strict decoding would emit nodes
    // Zod rejects.
    for (const type of WORKFLOW_NODE_TYPE_VALUES) {
      const node = {
        id: "n",
        type,
        laneId: "l",
        title: "t",
        position: { x: 0, y: 0 },
      };
      expect(
        CurrentStateWorkflowMapAIResponseSchema.shape.nodes.element.safeParse(
          node,
        ).success,
      ).toBe(true);
    }
    for (const type of FUTURE_NODE_TYPE_VALUES) {
      const node = {
        id: "n",
        type,
        laneId: "l",
        title: "t",
        position: { x: 0, y: 0 },
      };
      expect(
        FutureStateAIWorkflowMapAIResponseSchema.shape.nodes.element.safeParse(
          node,
        ).success,
      ).toBe(true);
    }
    for (const level of AUTOMATION_LEVEL_VALUES) {
      const node = {
        id: "n",
        type: "ai_assist",
        laneId: "l",
        title: "t",
        automationLevel: level,
        position: { x: 0, y: 0 },
      };
      expect(
        FutureStateAIWorkflowMapAIResponseSchema.shape.nodes.element.safeParse(
          node,
        ).success,
      ).toBe(true);
    }
  });

  it("a strict-mode payload (explicit nulls, no position) validates after stripNulls", () => {
    // What the model actually emits under strict mode: every key present,
    // optionals as null, no position field.
    const payload = {
      id: "csm_1",
      projectId: "p1",
      title: "Map",
      lanes: [{ id: "lane_a", title: "A", description: null }],
      nodes: [
        {
          id: "n1",
          type: "human_step",
          laneId: "lane_a",
          title: "Step",
          description: null,
          owner: null,
          systems: null,
          painPoints: ["slow"],
          risks: null,
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n1", label: null, style: null },
      ],
      assumptions: [],
      generatedFromSourceIds: [],
    };
    const result = CurrentStateWorkflowMapAIResponseSchema.safeParse(
      stripNulls(payload),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(result.data.nodes[0].owner).toBeUndefined();
    }
  });
});

describe("stripNulls", () => {
  it("removes null values recursively but keeps falsy non-nulls", () => {
    expect(
      stripNulls({
        a: null,
        b: 0,
        c: "",
        d: { e: null, f: false },
        g: [null, 1],
      }),
    ).toEqual({ b: 0, c: "", d: { f: false }, g: [null, 1].map(stripNulls) });
  });

  it("leaves arrays' null ELEMENTS intact but strips object keys inside them", () => {
    expect(stripNulls([{ a: null, b: 1 }])).toEqual([{ b: 1 }]);
  });
});
