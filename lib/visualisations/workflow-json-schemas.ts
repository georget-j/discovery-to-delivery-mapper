// Hand-written OpenAI strict-structured-output schemas for the two workflow
// map generations. Strict mode makes the decoder enforce enums, required
// keys, and no-extra-keys, so whole classes of "AI map failed validation"
// disappear at the source instead of being repaired after the fact.
//
// Strict-mode rules shape these definitions:
//  - every property must be listed in `required`; optionality is expressed as
//    a nullable type (generate-json strips the nulls before Zod validation);
//  - every object needs `additionalProperties: false`;
//  - `position` is deliberately ABSENT: the client re-lays out maps with the
//    swimlane auto-layout, so making the model emit coordinates was pure
//    token waste (the Zod AI schemas default positions to {x:0,y:0}).
//
// Keep enums in sync with workflow-types.ts — tests assert the agreement.

const str = { type: "string" } as const;
const nullableStr = { type: ["string", "null"] } as const;
const strArray = { type: "array", items: str } as const;
const nullableStrArray = {
  type: ["array", "null"],
  items: str,
} as const;

export const WORKFLOW_NODE_TYPE_VALUES = [
  "human_step",
  "system_step",
  "decision",
  "handoff",
  "delay",
  "risk",
  "missing_info",
  "data_object",
] as const;

export const FUTURE_NODE_TYPE_VALUES = [
  "human_action",
  "ai_assist",
  "ai_agent",
  "system_action",
  "data_retrieval",
  "guardrail",
  "decision_gate",
  "approval",
  "monitoring",
  "audit_log",
  "exception_path",
] as const;

export const AUTOMATION_LEVEL_VALUES = [
  "suggest_only",
  "draft_only",
  "human_approval_required",
  "autonomous_with_guardrails",
] as const;

const laneSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "description"],
  properties: {
    id: str,
    title: str,
    description: nullableStr,
  },
} as const;

const edgeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "source", "target", "label", "style"],
  properties: {
    id: str,
    source: str,
    target: str,
    label: nullableStr,
    style: { type: ["string", "null"], enum: ["solid", "dashed", null] },
  },
} as const;

const currentNodeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "type",
    "laneId",
    "title",
    "description",
    "owner",
    "systems",
    "painPoints",
    "risks",
  ],
  properties: {
    id: str,
    type: { type: "string", enum: WORKFLOW_NODE_TYPE_VALUES },
    laneId: str,
    title: str,
    description: nullableStr,
    owner: nullableStr,
    systems: nullableStrArray,
    painPoints: nullableStrArray,
    risks: nullableStrArray,
  },
} as const;

export const CURRENT_STATE_MAP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "title",
    "lanes",
    "nodes",
    "edges",
    "assumptions",
    "generatedFromSourceIds",
  ],
  properties: {
    id: str,
    projectId: str,
    title: str,
    lanes: { type: "array", items: laneSchema },
    nodes: { type: "array", items: currentNodeSchema },
    edges: { type: "array", items: edgeSchema },
    assumptions: strArray,
    generatedFromSourceIds: strArray,
  },
} as const;

const futureNodeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "type",
    "laneId",
    "title",
    "description",
    "aiRole",
    "automationLevel",
    "guardrails",
    "requiredHumanApproval",
    "auditEvents",
    "metrics",
    "sourceCurrentStateNodeIds",
  ],
  properties: {
    id: str,
    type: { type: "string", enum: FUTURE_NODE_TYPE_VALUES },
    laneId: str,
    title: str,
    description: nullableStr,
    aiRole: nullableStr,
    automationLevel: {
      type: ["string", "null"],
      enum: [...AUTOMATION_LEVEL_VALUES, null],
    },
    guardrails: nullableStrArray,
    requiredHumanApproval: { type: ["boolean", "null"] },
    auditEvents: nullableStrArray,
    metrics: nullableStrArray,
    sourceCurrentStateNodeIds: nullableStrArray,
  },
} as const;

export const FUTURE_STATE_MAP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "basedOnCurrentStateMapId",
    "title",
    "lanes",
    "nodes",
    "edges",
    "expectedBenefits",
    "newRisksIntroduced",
    "assumptions",
  ],
  properties: {
    id: str,
    projectId: str,
    basedOnCurrentStateMapId: nullableStr,
    title: str,
    lanes: { type: "array", items: laneSchema },
    nodes: { type: "array", items: futureNodeSchema },
    edges: { type: "array", items: edgeSchema },
    expectedBenefits: strArray,
    newRisksIntroduced: strArray,
    assumptions: strArray,
  },
} as const;
