// Types for Current-State and Future-State Workflow Maps.
// Matches the PDF spec schemas exactly.

import { z } from "zod";
import type { Position, GenerationSource, EdgeStyle } from "./types";

// ────────────────────────────────────────────────────────────
// Current-State Workflow Map
// ────────────────────────────────────────────────────────────

export type WorkflowNodeType =
  | "human_step"
  | "system_step"
  | "decision"
  | "handoff"
  | "delay"
  | "risk"
  | "missing_info"
  | "data_object";

export type WorkflowLane = {
  id: string;
  title: string;
  description?: string;
};

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  laneId: string;
  title: string;
  description?: string;
  owner?: string;
  systems?: string[];
  inputs?: string[];
  outputs?: string[];
  painPoints?: string[];
  risks?: string[];
  missingInfo?: string[];
  linkedRequirementIds?: string[];
  linkedRiskIds?: string[];
  sourceIds?: string[];
  position: Position;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: EdgeStyle;
};

export type CurrentStateWorkflowMap = {
  id: string;
  projectId: string;
  title: string;
  lanes: WorkflowLane[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  assumptions: string[];
  generatedFromSourceIds: string[];
  source: GenerationSource;
  updatedAt: string;
};

// ────────────────────────────────────────────────────────────
// Future-State AI Workflow Map
// ────────────────────────────────────────────────────────────

export type FutureWorkflowNodeType =
  | "human_action"
  | "ai_assist"
  | "ai_agent"
  | "system_action"
  | "data_retrieval"
  | "guardrail"
  | "decision_gate"
  | "approval"
  | "monitoring"
  | "audit_log"
  | "exception_path";

export type AutomationLevel =
  | "suggest_only"
  | "draft_only"
  | "human_approval_required"
  | "autonomous_with_guardrails";

export type FutureWorkflowNode = {
  id: string;
  type: FutureWorkflowNodeType;
  laneId: string;
  title: string;
  description?: string;
  aiRole?: string;
  automationLevel?: AutomationLevel;
  confidenceThreshold?: number;
  guardrails?: string[];
  requiredHumanApproval?: boolean;
  auditEvents?: string[];
  metrics?: string[];
  sourceCurrentStateNodeIds?: string[];
  position: Position;
};

export type FutureWorkflowEdge = WorkflowEdge;

export type FutureStateAIWorkflowMap = {
  id: string;
  projectId: string;
  basedOnCurrentStateMapId?: string;
  title: string;
  lanes: WorkflowLane[];
  nodes: FutureWorkflowNode[];
  edges: FutureWorkflowEdge[];
  expectedBenefits: string[];
  newRisksIntroduced: string[];
  assumptions: string[];
  source: GenerationSource;
  updatedAt: string;
};

// ────────────────────────────────────────────────────────────
// Zod schemas — for validating AI responses
// ────────────────────────────────────────────────────────────

const PositionSchema = z.object({ x: z.number(), y: z.number() });
const LaneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

const WORKFLOW_NODE_TYPES = [
  "human_step", "system_step", "decision", "handoff",
  "delay", "risk", "missing_info", "data_object",
] as const;

const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(WORKFLOW_NODE_TYPES),
  laneId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  owner: z.string().optional(),
  systems: z.array(z.string()).optional(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  painPoints: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  missingInfo: z.array(z.string()).optional(),
  linkedRequirementIds: z.array(z.string()).optional(),
  linkedRiskIds: z.array(z.string()).optional(),
  sourceIds: z.array(z.string()).optional(),
  position: PositionSchema,
});

const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  style: z.enum(["solid", "dashed"]).optional(),
});

export const CurrentStateWorkflowMapSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  lanes: z.array(LaneSchema),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  assumptions: z.array(z.string()),
  generatedFromSourceIds: z.array(z.string()),
  source: z.enum(["ai", "manual", "template_fallback"]),
  updatedAt: z.string(),
});

const FUTURE_NODE_TYPES = [
  "human_action", "ai_assist", "ai_agent", "system_action",
  "data_retrieval", "guardrail", "decision_gate", "approval",
  "monitoring", "audit_log", "exception_path",
] as const;

const AUTOMATION_LEVELS = [
  "suggest_only", "draft_only", "human_approval_required", "autonomous_with_guardrails",
] as const;

const FutureWorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(FUTURE_NODE_TYPES),
  laneId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  aiRole: z.string().optional(),
  automationLevel: z.enum(AUTOMATION_LEVELS).optional(),
  confidenceThreshold: z.number().optional(),
  guardrails: z.array(z.string()).optional(),
  requiredHumanApproval: z.boolean().optional(),
  auditEvents: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  sourceCurrentStateNodeIds: z.array(z.string()).optional(),
  position: PositionSchema,
});

export const FutureStateAIWorkflowMapSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  basedOnCurrentStateMapId: z.string().optional(),
  title: z.string(),
  lanes: z.array(LaneSchema),
  nodes: z.array(FutureWorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  expectedBenefits: z.array(z.string()),
  newRisksIntroduced: z.array(z.string()),
  assumptions: z.array(z.string()),
  source: z.enum(["ai", "manual", "template_fallback"]),
  updatedAt: z.string(),
});
