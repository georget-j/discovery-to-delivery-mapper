import type { OnboardingProject } from "../types";

// Bump when prompt body changes — used as part of stored-map metadata so we
// can invalidate cached outputs after a meaningful prompt edit.
export const WORKFLOW_PROMPT_VERSION = "2";

const SYSTEM_PROMPT_BASE = `You are an expert forward-deployed AI engineer producing structured visualisation data for an enterprise AI onboarding tool.

You return valid JSON conforming to the schema described in the user message. You never include markdown, prose, or explanation outside the JSON object.

You only use facts present in the project context — never invent customer system names, workflow steps, or stakeholders. When you infer something not directly stated, record it in the "assumptions" array.

When generating visualisations, produce specific, named nodes (not generic placeholders).`;

function serialiseProjectForViz(project: OnboardingProject): string {
  return JSON.stringify({
    customer: project.customer,
    discovery: project.discovery,
    workflows: project.workflows,
    systems: project.systems,
    dataSources: project.dataSources,
    stakeholders: project.stakeholders,
    risks: project.risks.slice(0, 8),
    ...(project.meetingNotes ? { meetingNotes: project.meetingNotes } : {}),
  }, null, 2);
}

// ────────────────────────────────────────────────────────────
// Current-State Workflow Map
// ────────────────────────────────────────────────────────────

export function buildCurrentStateWorkflowPrompt(project: OnboardingProject): { system: string; user: string } {
  return {
    system: `${SYSTEM_PROMPT_BASE}

This visualisation describes the customer's workflow as it operates today. You MUST NOT propose AI assistance, automation, or future-state changes — that is a separate visualisation.

Capture: actors, systems, manual steps, decisions, handoffs, data inputs/outputs, bottlenecks, risks, and missing information.`,

    user: `Generate a current-state workflow map for the customer below.

PROJECT CONTEXT (the ONLY facts you may use):
${serialiseProjectForViz(project)}

Return a JSON object with this shape. Field semantics are described in the comments; do NOT include the comments themselves in your output.

{
  "id": "<unique slug>",
  "projectId": "${project.id}",
  "title": "Current-State Workflow Map — <Customer> <Process>",
  "lanes": [
    { "id": "lane_operator",   "title": "Operator",   "description": "Human work" },
    { "id": "lane_systems",    "title": "Systems",    "description": "Current tools" },
    { "id": "lane_compliance", "title": "Compliance", "description": "Review / audit" },
    { "id": "lane_notes",      "title": "FDE Notes",  "description": "Gaps & risks" }
  ],
  "nodes": [
    {
      "id": "<unique slug>",
      "type": "human_step|system_step|decision|handoff|delay|risk|missing_info|data_object",
      "laneId": "<must match a lane id above>",
      "title": "<short label>",
      "description": "<one sentence>",
      "owner": "<who runs this step>",
      "systems": ["<systems used>"],
      "painPoints": ["<frustrations>"],
      "risks": ["<what can go wrong>"],
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    { "id": "<slug>", "source": "<node id>", "target": "<node id>", "label": "<optional>", "style": "solid|dashed" }
  ],
  "assumptions": ["<anything inferred rather than directly stated>"],
  "generatedFromSourceIds": []
}

LAYOUT RULES
- Lane y-coordinates: lane_operator y=80, lane_systems y=240, lane_compliance y=400, lane_notes y=560.
- Node x increases by ~240 per step, starting at x=80.

CONTENT RULES
- 6–10 nodes total.
- Connect them sequentially with solid edges; use "dashed" for exception or escalation paths.
- Include 2–3 "risk" or "missing_info" nodes in the FDE Notes lane.
- If the project workflows array is empty, produce a baseline 3-step illustrative flow and add an assumption noting that no concrete workflow was captured.`,
  };
}

// ────────────────────────────────────────────────────────────
// Future-State AI Workflow Map
// ────────────────────────────────────────────────────────────

export function buildFutureStateAIWorkflowPrompt(
  project: OnboardingProject,
  currentStateMap?: import("./workflow-types").CurrentStateWorkflowMap,
): { system: string; user: string } {
  return {
    system: `${SYSTEM_PROMPT_BASE}

This visualisation describes the proposed AI-enabled operating model. You must:
- Show exactly where AI assists, drafts, retrieves, recommends, or validates
- Show where humans remain accountable and where approval gates exist
- Make guardrails, low-confidence escalation, audit logging, and monitoring visible
- NOT blindly automate all manual work — high-risk steps should remain human-led with AI assistance
- Every AI node must define automationLevel, guardrails, and whether human approval is required`,

    user: `Generate a future-state AI workflow map for the customer below.

PROJECT CONTEXT (the ONLY facts you may use):
${serialiseProjectForViz(project)}

${currentStateMap ? `BASED ON CURRENT-STATE MAP:
${JSON.stringify(currentStateMap, null, 2)}

For each AI/human/system node, set sourceCurrentStateNodeIds to reference the current-state node(s) it replaces or evolves.

` : ""}Return a JSON object with this shape. Do NOT include comments in your output.

{
  "id": "<unique slug>",
  "projectId": "${project.id}",${currentStateMap ? `\n  "basedOnCurrentStateMapId": "${currentStateMap.id}",` : ""}
  "title": "Future-State AI Workflow Map — <Customer> <Process>",
  "lanes": [
    { "id": "lane_human",       "title": "Human",         "description": "Human decision" },
    { "id": "lane_ai",          "title": "AI Assistant",  "description": "Summarise / recommend" },
    { "id": "lane_systems",     "title": "Systems & Data", "description": "APIs / retrieval" },
    { "id": "lane_guardrails",  "title": "Guardrails",    "description": "Policy / confidence" },
    { "id": "lane_compliance",  "title": "Compliance",    "description": "Audit / supervisor" },
    { "id": "lane_monitoring",  "title": "Monitoring",    "description": "Telemetry / feedback" }
  ],
  "nodes": [
    {
      "id": "<slug>",
      "type": "human_action|ai_assist|ai_agent|system_action|data_retrieval|guardrail|decision_gate|approval|monitoring|audit_log|exception_path",
      "laneId": "<lane id>",
      "title": "<short label>",
      "description": "<one sentence>",
      "aiRole": "<only for ai_assist / ai_agent>",
      "automationLevel": "suggest_only|draft_only|human_approval_required|autonomous_with_guardrails",
      "guardrails": ["<policy / check>"],
      "requiredHumanApproval": true,
      "auditEvents": ["<what gets logged>"],
      "metrics": ["<what gets measured>"],
      "sourceCurrentStateNodeIds": ["<current-state node ids this evolves>"],
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    { "id": "<slug>", "source": "<node id>", "target": "<node id>", "label": "<optional>", "style": "solid|dashed" }
  ],
  "expectedBenefits": ["<concrete benefit>"],
  "newRisksIntroduced": ["<risk this design creates>"],
  "assumptions": ["<anything inferred>"]
}

LAYOUT RULES
- Lane y-coordinates: lane_human y=80, lane_ai y=200, lane_systems y=320, lane_guardrails y=440, lane_compliance y=560, lane_monitoring y=680.
- Node x increases by ~240 per logical step.

CONTENT RULES
- 8–12 nodes total.
- Always include at least one guardrail node, one monitoring node, and one audit_log node.
- For regulated or high-risk industries (finance, healthcare, legal), set requiredHumanApproval: true on any ai_assist or ai_agent node touching sensitive decisions, and route low-confidence cases via an exception_path edge (dashed) to a human reviewer.
- expectedBenefits and newRisksIntroduced each need 2–4 specific items (no generic statements).`,
  };
}
