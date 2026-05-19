import type { OnboardingProject } from "../types";

const SYSTEM_PROMPT_BASE = `You are an expert forward-deployed AI engineer producing structured visualisation data for an enterprise AI onboarding tool.

You return valid JSON conforming to the schema described in the user message. You never include markdown, prose, or explanation outside the JSON object.

When generating visualisations, you draw on the customer context provided to produce specific, named nodes (not generic placeholders). You always include assumptions for anything that was inferred rather than directly stated.`;

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

This visualisation describes the customer's workflow **as it operates today**. You MUST NOT propose AI assistance, automation, or future-state changes — that is a separate visualisation.

Capture: actors, systems, manual steps, decisions, handoffs, data inputs/outputs, bottlenecks, risks, and missing information.`,

    user: `Generate a current-state workflow map for the customer below.

PROJECT CONTEXT:
${serialiseProjectForViz(project)}

Return a JSON object with exactly this shape:
{
  "id": string,                  // any unique slug
  "projectId": "${project.id}",
  "title": string,               // e.g. "Current-State Workflow Map — <Customer> <Process>"
  "lanes": [                     // 3-5 swimlanes; use these unless customer context demands different ones
    { "id": "lane_operator",   "title": "Operator",   "description": "Human work" },
    { "id": "lane_systems",    "title": "Systems",    "description": "Current tools" },
    { "id": "lane_compliance", "title": "Compliance", "description": "Review / audit" },
    { "id": "lane_notes",      "title": "FDE Notes",  "description": "Gaps & risks" }
  ],
  "nodes": [
    {
      "id": string,
      "type": "human_step" | "system_step" | "decision" | "handoff" | "delay" | "risk" | "missing_info" | "data_object",
      "laneId": string,          // must match a lane id above
      "title": string,
      "description": string,
      "owner": string,           // who does this step
      "systems": string[],       // systems used at this step
      "painPoints": string[],
      "risks": string[],
      "position": { "x": number, "y": number }   // layout left-to-right; x increases by ~240px per step, y matches lane
    }
  ],
  "edges": [
    { "id": string, "source": string, "target": string, "label": string, "style": "solid" | "dashed" }
  ],
  "assumptions": string[],
  "generatedFromSourceIds": [],
  "source": "ai",
  "updatedAt": "${new Date().toISOString()}"
}

Lane y-coordinates: lane_operator y=80, lane_systems y=240, lane_compliance y=400, lane_notes y=560.
Aim for 6-10 nodes total. Connect them sequentially with edges. Use "dashed" style for exception/escalation paths.
Include 2-3 "risk" or "missing_info" nodes in the FDE Notes lane to highlight bottlenecks and unresolved questions.`,
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

This visualisation describes the **proposed AI-enabled operating model**. You must:
- Show exactly where AI assists, drafts, retrieves, recommends, or validates
- Show where humans remain accountable and where approval gates exist
- Make guardrails, low-confidence escalation, audit logging, and monitoring visible
- NOT blindly automate all manual work — high-risk steps should remain human-led with AI assistance
- Every AI node must define automationLevel, guardrails, and whether human approval is required`,

    user: `Generate a future-state AI workflow map for the customer below.

PROJECT CONTEXT:
${serialiseProjectForViz(project)}

${currentStateMap ? `BASED ON CURRENT-STATE MAP:
${JSON.stringify(currentStateMap, null, 2)}

For each AI/human/system node, set sourceCurrentStateNodeIds to reference the current-state node(s) it replaces or evolves.

` : ""}Return a JSON object with exactly this shape:
{
  "id": string,
  "projectId": "${project.id}",
  ${currentStateMap ? `"basedOnCurrentStateMapId": "${currentStateMap.id}",` : ""}
  "title": string,
  "lanes": [
    { "id": "lane_human",       "title": "Human",       "description": "Human decision" },
    { "id": "lane_ai",          "title": "AI Assistant", "description": "Summarise / recommend" },
    { "id": "lane_systems",     "title": "Systems & Data", "description": "APIs / retrieval" },
    { "id": "lane_guardrails",  "title": "Guardrails",  "description": "Policy / confidence" },
    { "id": "lane_compliance",  "title": "Compliance",  "description": "Audit / supervisor" },
    { "id": "lane_monitoring",  "title": "Monitoring",  "description": "Telemetry / feedback" }
  ],
  "nodes": [
    {
      "id": string,
      "type": "human_action" | "ai_assist" | "ai_agent" | "system_action" | "data_retrieval" | "guardrail" | "decision_gate" | "approval" | "monitoring" | "audit_log" | "exception_path",
      "laneId": string,
      "title": string,
      "description": string,
      "aiRole": string,            // only for ai_assist / ai_agent nodes
      "automationLevel": "suggest_only" | "draft_only" | "human_approval_required" | "autonomous_with_guardrails",
      "guardrails": string[],
      "requiredHumanApproval": boolean,
      "auditEvents": string[],
      "metrics": string[],
      "sourceCurrentStateNodeIds": string[],
      "position": { "x": number, "y": number }
    }
  ],
  "edges": [
    { "id": string, "source": string, "target": string, "label": string, "style": "solid" | "dashed" }
  ],
  "expectedBenefits": string[],
  "newRisksIntroduced": string[],
  "assumptions": string[],
  "source": "ai",
  "updatedAt": "${new Date().toISOString()}"
}

Lane y-coordinates: lane_human y=80, lane_ai y=200, lane_systems y=320, lane_guardrails y=440, lane_compliance y=560, lane_monitoring y=680.
Aim for 8-12 nodes total. Always include at least one guardrail node, one monitoring node, and one audit_log node.
For regulated/high-risk industries (e.g. finance, healthcare, legal), set requiredHumanApproval: true on any ai_assist / ai_agent node touching sensitive decisions, and route low-confidence cases via an exception_path edge (dashed) to a human reviewer.`,
  };
}
