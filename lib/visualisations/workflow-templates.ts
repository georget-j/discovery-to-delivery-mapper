// Deterministic templates used as fallbacks when no AI key is present
// or when AI generation fails schema validation.

import type { OnboardingProject } from "../types";
import type {
  CurrentStateWorkflowMap,
  WorkflowNode,
  WorkflowEdge,
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowEdge,
  FutureWorkflowNodeType,
  AutomationLevel,
} from "./workflow-types";
import { generateId } from "../utils";
import { hashWorkflows } from "./workflow-helpers";

const CURRENT_LANES = [
  { id: "lane_operator", title: "Operator", description: "Human work" },
  { id: "lane_systems", title: "Systems", description: "Current tools" },
  { id: "lane_compliance", title: "Compliance", description: "Review / audit" },
  { id: "lane_notes", title: "FDE Notes", description: "Gaps & risks" },
];

const LANE_Y: Record<string, number> = {
  lane_operator: 80,
  lane_systems: 240,
  lane_compliance: 400,
  lane_notes: 560,
};

const X_STEP = 240;
const X_START = 80;

export function buildCurrentStateWorkflowTemplate(
  project: OnboardingProject,
): CurrentStateWorkflowMap {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // 1. Build a horizontal sequence from project.workflows (one human_step per step).
  let prevHumanId: string | null = null;
  project.workflows.forEach((wf, i) => {
    const id = `n_step_${i + 1}`;
    nodes.push({
      id,
      type: "human_step",
      laneId: "lane_operator",
      title: wf.name || `Step ${i + 1}`,
      description: wf.description || undefined,
      owner: wf.ownerTeam || undefined,
      systems: wf.currentSystem ? [wf.currentSystem] : [],
      painPoints: wf.painPoints?.filter(Boolean) ?? [],
      position: { x: X_START + i * X_STEP, y: LANE_Y.lane_operator },
    });
    if (prevHumanId) {
      edges.push({
        id: `e_${prevHumanId}_${id}`,
        source: prevHumanId,
        target: id,
        style: "solid",
      });
    }
    prevHumanId = id;
  });

  // 2. Add a system_step under each unique current system, connected to the workflow that uses it.
  const seenSystems = new Set<string>();
  project.workflows.forEach((wf, i) => {
    const sys = wf.currentSystem?.trim();
    if (!sys || seenSystems.has(sys)) return;
    seenSystems.add(sys);
    const sysId = `n_sys_${seenSystems.size}`;
    nodes.push({
      id: sysId,
      type: "system_step",
      laneId: "lane_systems",
      title: sys,
      description: `Used at: ${wf.name}`,
      position: { x: X_START + i * X_STEP, y: LANE_Y.lane_systems },
    });
    edges.push({
      id: `e_${sysId}_n_step_${i + 1}`,
      source: sysId,
      target: `n_step_${i + 1}`,
      label: "data",
      style: "dashed",
    });
  });

  // 3. Add a final compliance/review node if any workflow mentions review/escalation.
  const hasReview = project.workflows.some((w) =>
    /review|escalat|audit|approv/i.test(`${w.name} ${w.description}`),
  );
  if (hasReview && project.workflows.length > 0) {
    const id = "n_compliance_review";
    nodes.push({
      id,
      type: "decision",
      laneId: "lane_compliance",
      title: "Supervisor review",
      description: "Manual review of escalated cases",
      position: {
        x: X_START + (project.workflows.length - 1) * X_STEP,
        y: LANE_Y.lane_compliance,
      },
    });
    edges.push({
      id: `e_n_step_${project.workflows.length}_${id}`,
      source: `n_step_${project.workflows.length}`,
      target: id,
      style: "dashed",
      label: "if escalated",
    });
  }

  // 4. Add 1-2 FDE notes about gaps from the missing-info-engine inputs we can see directly.
  const noteY = LANE_Y.lane_notes;
  if (!project.discovery.currentProcess) {
    nodes.push({
      id: "n_note_process",
      type: "missing_info",
      laneId: "lane_notes",
      title: "Current process not documented",
      description: "Discovery still needs a written process map.",
      position: { x: X_START, y: noteY },
    });
  }
  const blockedSystems = project.systems
    .filter((s) => s.apiAvailable === false)
    .map((s) => s.name);
  if (blockedSystems.length > 0) {
    nodes.push({
      id: "n_note_apis",
      type: "risk",
      laneId: "lane_notes",
      title: `${blockedSystems.length} system${blockedSystems.length > 1 ? "s" : ""} with no API`,
      description: `Custom integration required: ${blockedSystems.join(", ")}`,
      position: { x: X_START + X_STEP, y: noteY },
    });
  }

  return {
    id: `csm_${project.id}_${Date.now()}`,
    projectId: project.id,
    title: `Current-State Workflow Map — ${project.customer.companyName}`,
    lanes: CURRENT_LANES,
    nodes,
    edges,
    assumptions: [
      "Workflow steps mapped 1:1 from the structured Workflow tab. Refine in the canvas to add handoffs, delays, and decision points.",
    ],
    generatedFromSourceIds: project.workflows.map((w) => w.id),
    source: "template_fallback",
    updatedAt: new Date().toISOString(),
    derivedFromHash: hashWorkflows(project.workflows),
  };
}

// ────────────────────────────────────────────────────────────
// Future-State template
// ────────────────────────────────────────────────────────────

const FUTURE_LANES = [
  { id: "lane_human", title: "Human", description: "Human decision" },
  {
    id: "lane_ai",
    title: "AI Assistant",
    description: "Summarise / recommend",
  },
  {
    id: "lane_systems",
    title: "Systems & Data",
    description: "APIs / retrieval",
  },
  {
    id: "lane_guardrails",
    title: "Guardrails",
    description: "Policy / confidence",
  },
  {
    id: "lane_compliance",
    title: "Compliance",
    description: "Audit / supervisor",
  },
  {
    id: "lane_monitoring",
    title: "Monitoring",
    description: "Telemetry / feedback",
  },
];

// 160px lane pitch matches the swimlane band height (WorkflowLaneBackground
// laneHeight=160) so bands tile cleanly and tall nodes don't bleed into the
// lane below. Keep in sync with futureWorkflowUtils.FUTURE_LANE_Y.
const FUTURE_LANE_Y: Record<string, number> = {
  lane_human: 80,
  lane_ai: 240,
  lane_systems: 400,
  lane_guardrails: 560,
  lane_compliance: 720,
  lane_monitoring: 880,
};

function futureStateConfig(state: string): {
  type: FutureWorkflowNodeType;
  lane: string;
  level: AutomationLevel;
  needsApproval: boolean;
} {
  switch (state) {
    case "ai_assisted":
      return {
        type: "ai_assist",
        lane: "lane_ai",
        level: "draft_only",
        needsApproval: false,
      };
    case "automated":
      return {
        type: "ai_agent",
        lane: "lane_ai",
        level: "autonomous_with_guardrails",
        needsApproval: false,
      };
    case "requires_approval":
      return {
        type: "human_action",
        lane: "lane_human",
        level: "human_approval_required",
        needsApproval: true,
      };
    default:
      return {
        type: "human_action",
        lane: "lane_human",
        level: "suggest_only",
        needsApproval: false,
      };
  }
}

export function buildFutureStateAIWorkflowTemplate(
  project: OnboardingProject,
  currentStateMapId?: string,
): FutureStateAIWorkflowMap {
  const nodes: FutureWorkflowNode[] = [];
  const edges: FutureWorkflowEdge[] = [];

  const isRegulated = project.customer.regulatoryContext.length > 0;

  // 1. System/data retrieval node at the start
  if (project.systems.length > 0) {
    nodes.push({
      id: "n_data_retrieval",
      type: "data_retrieval",
      laneId: "lane_systems",
      title: "Collect context",
      description:
        project.systems
          .slice(0, 3)
          .map((s) => s.name)
          .join(", ") +
        (project.systems.length > 3
          ? ` (+${project.systems.length - 3} more)`
          : ""),
      position: { x: X_START, y: FUTURE_LANE_Y.lane_systems },
    });
  }

  // 2. One node per workflow step, typed by its futureState
  let prevId = "n_data_retrieval";
  let xCursor = X_START + X_STEP;
  project.workflows.forEach((wf, i) => {
    const cfg = futureStateConfig(wf.futureState);
    const id = `n_step_${i + 1}`;
    nodes.push({
      id,
      type: cfg.type,
      laneId: cfg.lane,
      title: wf.name,
      description: wf.description || undefined,
      aiRole:
        cfg.type === "ai_assist" || cfg.type === "ai_agent"
          ? `Drafts/recommends for: ${wf.name}`
          : undefined,
      automationLevel: cfg.level,
      requiredHumanApproval: cfg.needsApproval || isRegulated,
      guardrails: isRegulated
        ? ["PII redaction", "Confidence threshold"]
        : ["Confidence threshold"],
      sourceCurrentStateNodeIds: [`n_step_${i + 1}`],
      position: { x: xCursor, y: FUTURE_LANE_Y[cfg.lane] },
    });
    edges.push({
      id: `e_${prevId}_${id}`,
      source: prevId,
      target: id,
      style: "solid",
    });
    prevId = id;
    xCursor += X_STEP;
  });

  // 3. Guardrail node before final compliance review (if regulated)
  if (isRegulated && project.workflows.length > 0) {
    nodes.push({
      id: "n_guardrail",
      type: "guardrail",
      laneId: "lane_guardrails",
      title: "Policy checks",
      description: "PII, confidence, allowed actions",
      guardrails: [
        "No case closure without user",
        "PII redaction",
        "Escalate low confidence",
      ],
      position: { x: xCursor, y: FUTURE_LANE_Y.lane_guardrails },
    });
    edges.push({
      id: `e_${prevId}_n_guardrail`,
      source: prevId,
      target: "n_guardrail",
      style: "solid",
    });
    prevId = "n_guardrail";
    xCursor += X_STEP;
  }

  // 4. Decision gate for confidence-based escalation
  nodes.push({
    id: "n_decision",
    type: "decision_gate",
    laneId: "lane_human",
    title: "Review?",
    description: "Confidence gate",
    position: { x: xCursor, y: FUTURE_LANE_Y.lane_human },
  });
  edges.push({
    id: `e_${prevId}_n_decision`,
    source: prevId,
    target: "n_decision",
    style: "solid",
  });

  // 5. Compliance escalation path (dashed, exception)
  nodes.push({
    id: "n_compliance",
    type: "approval",
    laneId: "lane_compliance",
    title: "Supervisor review",
    description: "Handles low-confidence or high-risk cases",
    position: { x: xCursor, y: FUTURE_LANE_Y.lane_compliance },
  });
  edges.push({
    id: "e_n_decision_n_compliance",
    source: "n_decision",
    target: "n_compliance",
    style: "dashed",
    label: "low confidence",
  });

  // 6. Audit log node
  nodes.push({
    id: "n_audit",
    type: "audit_log",
    laneId: "lane_monitoring",
    title: "Log outcomes",
    description: "Prompt, output, user edits, decision",
    auditEvents: ["AI prompt", "AI output", "Human edit", "Final decision"],
    position: { x: xCursor + X_STEP, y: FUTURE_LANE_Y.lane_monitoring },
  });
  edges.push({
    id: "e_n_decision_n_audit",
    source: "n_decision",
    target: "n_audit",
    style: "dashed",
  });

  // 7. Monitoring/metrics node
  nodes.push({
    id: "n_monitoring",
    type: "monitoring",
    laneId: "lane_monitoring",
    title: "Metrics",
    description: "Time, accuracy, audit completeness",
    metrics: ["Handling time", "Accuracy", "Override rate", "PII incidents"],
    position: { x: X_START, y: FUTURE_LANE_Y.lane_monitoring },
  });

  return {
    id: `fsm_${project.id}_${Date.now()}`,
    projectId: project.id,
    basedOnCurrentStateMapId: currentStateMapId,
    title: `Future-State AI Workflow Map — ${project.customer.companyName}`,
    lanes: FUTURE_LANES,
    nodes,
    edges,
    expectedBenefits: [
      "Faster handling time via AI-drafted output for human review",
      "Improved consistency through guardrails and policy checks",
      "Better audit trail via structured logging of every AI decision",
    ],
    newRisksIntroduced: [
      "PII may enter prompt context if redaction is incomplete",
      "Over-reliance on AI drafts may reduce reviewer scrutiny",
      isRegulated
        ? "Regulatory acceptance of AI-assisted decisions requires documented evidence trail"
        : "Adoption risk if reviewers don't trust the AI output",
    ],
    assumptions: [
      "Future-state derived from workflow tab futureState field. Refine in canvas to adjust automation levels and add guardrails.",
    ],
    source: "template_fallback",
    updatedAt: new Date().toISOString(),
    derivedFromHash: hashWorkflows(project.workflows),
  };
}
