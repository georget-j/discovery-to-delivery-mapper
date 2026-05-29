// Deterministic, instant proposal rules for the future-state AI workflow map.
// Given a node (or the whole map) + the project, suggest concrete "you could
// layer this in" moves — add an AI agent, a validator/guardrail, monitoring,
// or a human-approval gate — each anchored to a pattern family from
// lib/patterns/future-state-patterns.ts. No AI call: these fire on hover with
// zero latency. The richer, project-specific proposals come from the
// "Ask AI for ideas" path (the recommend endpoint), mapped into the same shape.

import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import type { AutomationPatternFamily, OnboardingProject } from "@/lib/types";

// A node to insert, minus the fields the apply step assigns (id + position).
// `key` is a local handle so a blueprint's internal edges + back-connections
// can reference a node before its real id exists.
export type ProposalNodeSpec = Omit<FutureWorkflowNode, "id" | "position"> & {
  key?: string;
};

export type NodeProposal = {
  id: string; // stable per (sourceNode, rule) so dismissals/keys are stable
  title: string;
  rationale: string;
  patternFamily: AutomationPatternFamily;
  // "node" = a small add next to one step (default). "workflow" = a blueprint
  // that restructures the whole flow (orchestrator + agent/validator fan-out,
  // etc.) — surfaced prominently as "Transform the workflow".
  scope?: "node" | "workflow";
  insert: {
    nodes: ProposalNodeSpec[];
    // Wire an edge from the triggering node into the first inserted node.
    connectFromSource: boolean;
    // Edges between inserted nodes, referenced by their `key`. When present,
    // these replace the default linear chaining of inserted nodes.
    internalEdges?: { from: string; to: string }[];
    // Wire an inserted node (by key) back into an existing map node by id —
    // lets a blueprint slot itself into the current flow.
    connectToExisting?: { fromKey: string; toNodeId: string }[];
  };
};

// Map a pattern family → the node a proposal should insert. Shared by the
// "Ask AI for ideas" path, which receives recommendations keyed by family
// and turns them into the same NodeProposal shape Apply understands.
const FAMILY_TO_SPEC: Record<
  AutomationPatternFamily,
  { type: FutureWorkflowNodeType; laneId: string }
> = {
  agent: { type: "ai_agent", laneId: "lane_ai" },
  agent_with_validator: { type: "guardrail", laneId: "lane_guardrails" },
  multi_agent: { type: "ai_agent", laneId: "lane_ai" },
  rag: { type: "ai_assist", laneId: "lane_ai" },
  rules_plus_ai: { type: "guardrail", laneId: "lane_guardrails" },
  hitl: { type: "approval", laneId: "lane_compliance" },
  continuous_learning: { type: "monitoring", laneId: "lane_monitoring" },
  copilot: { type: "ai_assist", laneId: "lane_ai" },
};

export function proposalFromPattern(
  family: AutomationPatternFamily,
  title: string,
  rationale: string,
  idSeed: string,
): NodeProposal {
  const spec = FAMILY_TO_SPEC[family] ?? FAMILY_TO_SPEC.agent;
  return {
    id: `ai:${idSeed}`,
    title,
    rationale,
    patternFamily: family,
    insert: {
      connectFromSource: true,
      nodes: [
        {
          type: spec.type,
          laneId: spec.laneId,
          title,
          description: rationale,
          ...(spec.type === "ai_agent" || spec.type === "ai_assist"
            ? {
                automationLevel: "draft_only" as const,
                requiredHumanApproval: true,
                guardrails: ["Confidence threshold"],
              }
            : {}),
        },
      ],
    },
  };
}

const AI_TYPES: FutureWorkflowNodeType[] = ["ai_assist", "ai_agent"];
const AUTOMATABLE_TYPES: FutureWorkflowNodeType[] = [
  "human_action",
  "system_action",
  "data_retrieval",
];

// One-hop downstream neighbours of a node (edge source === node.id).
function downstreamTypes(
  node: FutureWorkflowNode,
  map: FutureStateAIWorkflowMap,
): Set<FutureWorkflowNodeType> {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const out = new Set<FutureWorkflowNodeType>();
  for (const e of map.edges) {
    if (e.source === node.id) {
      const t = byId.get(e.target);
      if (t) out.add(t.type);
    }
  }
  return out;
}

function mapHasType(
  map: FutureStateAIWorkflowMap,
  types: FutureWorkflowNodeType[],
): boolean {
  return map.nodes.some((n) => types.includes(n.type));
}

function isRegulated(project: OnboardingProject): boolean {
  return (project.customer.regulatoryContext?.length ?? 0) > 0;
}

// ── Per-node rules ──────────────────────────────────────────────────────────

export function proposeForNode(
  node: FutureWorkflowNode,
  map: FutureStateAIWorkflowMap,
  project: OnboardingProject,
): NodeProposal[] {
  const proposals: NodeProposal[] = [];
  const downstream = downstreamTypes(node, map);
  const isAi = AI_TYPES.includes(node.type);

  // Rule 1 — a manual/system/retrieval step with no AI downstream: propose an
  // AI agent that does the work.
  if (
    AUTOMATABLE_TYPES.includes(node.type) &&
    !AI_TYPES.some((t) => downstream.has(t))
  ) {
    proposals.push({
      id: `${node.id}:add-agent`,
      title: "Propose an AI agent for this step",
      rationale: `"${node.title}" looks like repetitive work an agent could draft, with a human confirming the result.`,
      patternFamily: "agent",
      insert: {
        connectFromSource: true,
        nodes: [
          {
            type: "ai_agent",
            laneId: "lane_ai",
            title: `AI agent · ${node.title}`,
            description: `Drafts the output for "${node.title}"; routes low-confidence cases to a human.`,
            automationLevel: "draft_only",
            requiredHumanApproval: true,
            guardrails: ["Confidence threshold"],
          },
        ],
      },
    });
  }

  // Rule 2 — an AI node with no validator/guardrail downstream: layer in a
  // validator to verify outputs (agent-with-validator pattern).
  if (isAi && !downstream.has("guardrail")) {
    proposals.push({
      id: `${node.id}:add-validator`,
      title: "Layer in a validator to verify the work",
      rationale: `Add a second-look guardrail after "${node.title}" so outputs above a confidence threshold are independently checked.`,
      patternFamily: "agent_with_validator",
      insert: {
        connectFromSource: true,
        nodes: [
          {
            type: "guardrail",
            laneId: "lane_guardrails",
            title: "Validator agent",
            description: `Independently re-derives and checks the output of "${node.title}"; disagreements escalate to a human.`,
            guardrails: ["Confidence threshold", "Independent re-derivation"],
          },
        ],
      },
    });
  }

  // Rule 3 — an AI node with no monitoring/audit anywhere: add monitoring +
  // audit log so the work can be validated in production.
  if (isAi && !mapHasType(map, ["monitoring", "audit_log"])) {
    proposals.push({
      id: `${node.id}:add-monitoring`,
      title: "Add monitoring + audit log",
      rationale: `Capture accuracy, override rate, and an audit trail for "${node.title}" so quality is provable in production.`,
      patternFamily: "continuous_learning",
      insert: {
        connectFromSource: true,
        nodes: [
          {
            type: "monitoring",
            laneId: "lane_monitoring",
            title: "Quality monitoring",
            description:
              "Tracks confidence, human-override rate, and drift over time.",
            metrics: ["Override rate", "Confidence distribution", "Drift"],
          },
          {
            type: "audit_log",
            laneId: "lane_monitoring",
            title: "Audit log",
            description: "Immutable record of each decision + evidence used.",
            auditEvents: ["Decision", "Evidence", "Reviewer"],
          },
        ],
      },
    });
  }

  // Rule 4 — regulated context + AI node with no approval downstream: add a
  // human-approval gate before the action commits (HITL pattern).
  if (
    isAi &&
    isRegulated(project) &&
    !downstream.has("approval") &&
    !node.requiredHumanApproval
  ) {
    proposals.push({
      id: `${node.id}:add-approval`,
      title: "Add a human-approval gate",
      rationale: `${(project.customer.regulatoryContext ?? []).slice(0, 2).join(", ")} context means "${node.title}" should get sign-off before it commits.`,
      patternFamily: "hitl",
      insert: {
        connectFromSource: true,
        nodes: [
          {
            type: "approval",
            laneId: "lane_compliance",
            title: "Human approval",
            description: `Reviewer signs off the output of "${node.title}" before it takes effect.`,
            requiredHumanApproval: true,
          },
        ],
      },
    });
  }

  return proposals;
}

// ── Whole-map rules ─────────────────────────────────────────────────────────
// Aggregates per-node proposals, then adds map-level proposals that aren't
// tied to a single node. Deduped so the same structural gap isn't proposed
// from many nodes at once.

export type MapProposalGroup = {
  nodeId: string | null;
  nodeTitle: string | null;
  proposals: NodeProposal[];
};

export function proposeForMap(
  map: FutureStateAIWorkflowMap,
  project: OnboardingProject,
): MapProposalGroup[] {
  const groups: MapProposalGroup[] = [];
  const hasAi = mapHasType(map, AI_TYPES);

  // Whole-workflow blueprints lead — they're the "how to change the full
  // workflow" answer the rail headlines as "Transform the workflow".
  const mapProposals: NodeProposal[] = [
    ...proposeWorkflowBlueprints(map, project),
  ];
  if (hasAi && !mapHasType(map, ["guardrail"])) {
    mapProposals.push({
      id: "map:guardrail-layer",
      title: "This workflow has AI but no guardrails",
      rationale:
        "Add a validator/guardrail layer so AI outputs are checked before they're trusted.",
      patternFamily: "agent_with_validator",
      insert: {
        connectFromSource: false,
        nodes: [
          {
            type: "guardrail",
            laneId: "lane_guardrails",
            title: "Validator agent",
            description:
              "Independently checks AI outputs above a confidence threshold.",
            guardrails: ["Confidence threshold"],
          },
        ],
      },
    });
  }
  if (hasAi && !mapHasType(map, ["monitoring", "audit_log"])) {
    mapProposals.push({
      id: "map:monitoring-layer",
      title: "No monitoring or audit trail yet",
      rationale:
        "Add monitoring + an audit log so the AI's quality is provable in production.",
      patternFamily: "continuous_learning",
      insert: {
        connectFromSource: false,
        nodes: [
          {
            type: "monitoring",
            laneId: "lane_monitoring",
            title: "Quality monitoring",
            metrics: ["Override rate", "Confidence distribution", "Drift"],
          },
          {
            type: "audit_log",
            laneId: "lane_monitoring",
            title: "Audit log",
            auditEvents: ["Decision", "Evidence", "Reviewer"],
          },
        ],
      },
    });
  }
  if (mapProposals.length > 0) {
    groups.push({ nodeId: null, nodeTitle: null, proposals: mapProposals });
  }

  // Per-node proposals, skipping rules already covered by a map-level gap so
  // we don't show "add monitoring" once per AI node when the map has none.
  const mapCoversMonitoring = mapProposals.some(
    (p) => p.id === "map:monitoring-layer",
  );
  const mapCoversGuardrail = mapProposals.some(
    (p) => p.id === "map:guardrail-layer",
  );
  for (const node of map.nodes) {
    const perNode = proposeForNode(node, map, project).filter((p) => {
      if (mapCoversMonitoring && p.id.endsWith(":add-monitoring")) return false;
      if (mapCoversGuardrail && p.id.endsWith(":add-validator")) return false;
      return true;
    });
    if (perNode.length > 0) {
      groups.push({
        nodeId: node.id,
        nodeTitle: node.title,
        proposals: perNode,
      });
    }
  }

  return groups;
}

// ── Whole-workflow blueprints ───────────────────────────────────────────────
// Multi-node sub-graphs that restructure the flow rather than appending a
// single node. These answer "how should the WHOLE workflow change" — e.g. an
// orchestrator above the process fanning out to a series of agent→validator
// pairs. Each carries scope:"workflow" so the rail headlines them, internal
// edges that wire the sub-graph together, and (optionally) a back-connection
// into the existing flow.
export function proposeWorkflowBlueprints(
  map: FutureStateAIWorkflowMap,
  project: OnboardingProject,
): NodeProposal[] {
  const out: NodeProposal[] = [];
  const stepCount = map.nodes.length;
  const hasOrchestrator = map.nodes.some(
    (n) => /orchestrat/i.test(n.title) && n.type === "ai_agent",
  );

  // Blueprint 1 — Orchestrated multi-agent pipeline with per-stage validators.
  // The headline "full workflow" transform the user asked for.
  if (stepCount >= 2 && !hasOrchestrator) {
    out.push({
      id: "blueprint:orchestrated-pipeline",
      scope: "workflow",
      patternFamily: "multi_agent",
      title: "Orchestrate this as a multi-agent pipeline",
      rationale:
        "Put an orchestrator above the process that routes each sub-task to a specialist agent, with a validator on each branch and shared monitoring — instead of one monolithic step.",
      insert: {
        connectFromSource: false,
        nodes: [
          {
            key: "orch",
            type: "ai_agent",
            laneId: "lane_ai",
            title: "Orchestrator agent",
            description:
              "Plans the task, routes each sub-task to a specialist agent, and assembles the validated results.",
            automationLevel: "autonomous_with_guardrails",
            requiredHumanApproval: false,
            guardrails: ["Routing policy", "Budget / step cap"],
          },
          {
            key: "agentA",
            type: "ai_agent",
            laneId: "lane_ai",
            title: "Specialist agent · analysis",
            description: "Handles the analysis sub-task end-to-end.",
            automationLevel: "draft_only",
            guardrails: ["Confidence threshold"],
          },
          {
            key: "valA",
            type: "guardrail",
            laneId: "lane_guardrails",
            title: "Validator · analysis",
            description:
              "Independently re-derives and checks the analysis agent's output.",
            guardrails: ["Independent re-derivation", "Confidence threshold"],
          },
          {
            key: "agentB",
            type: "ai_agent",
            laneId: "lane_ai",
            title: "Specialist agent · drafting",
            description: "Produces the drafted output for the next stage.",
            automationLevel: "draft_only",
            guardrails: ["Confidence threshold"],
          },
          {
            key: "valB",
            type: "guardrail",
            laneId: "lane_guardrails",
            title: "Validator · drafting",
            description: "Checks the drafted output before it proceeds.",
            guardrails: ["Independent re-derivation"],
          },
          {
            key: "mon",
            type: "monitoring",
            laneId: "lane_monitoring",
            title: "Pipeline monitoring",
            description:
              "Tracks per-agent confidence, override rate, and drift across the pipeline.",
            metrics: ["Override rate", "Confidence", "Drift", "Latency"],
          },
        ],
        internalEdges: [
          { from: "orch", to: "agentA" },
          { from: "agentA", to: "valA" },
          { from: "orch", to: "agentB" },
          { from: "agentB", to: "valB" },
          { from: "valA", to: "mon" },
          { from: "valB", to: "mon" },
        ],
      },
    });
  }

  // Blueprint 2 — High-confidence agent → validator → human-approval chain.
  if (stepCount >= 1) {
    const regulated = (project.customer.regulatoryContext?.length ?? 0) > 0;
    out.push({
      id: "blueprint:validated-chain",
      scope: "workflow",
      patternFamily: "agent_with_validator",
      title: "Add a high-confidence agent → validator → approval chain",
      rationale: regulated
        ? "A primary agent drafts, a validator independently checks, and a human signs off before it commits — the defensible pattern for regulated work."
        : "A primary agent drafts, a validator independently checks high-confidence cases, and borderline ones escalate to a human.",
      insert: {
        connectFromSource: false,
        nodes: [
          {
            key: "agent",
            type: "ai_agent",
            laneId: "lane_ai",
            title: "Primary agent",
            description: "Drafts the output for the workflow's core decision.",
            automationLevel: "draft_only",
            guardrails: ["Confidence threshold"],
          },
          {
            key: "validator",
            type: "guardrail",
            laneId: "lane_guardrails",
            title: "Validator agent",
            description:
              "Independently re-derives the result; agreement above threshold passes, else escalate.",
            guardrails: ["Independent re-derivation", "Confidence threshold"],
          },
          {
            key: "approval",
            type: "approval",
            laneId: "lane_compliance",
            title: "Human approval",
            description: "Reviewer signs off escalations before they commit.",
            requiredHumanApproval: true,
          },
          {
            key: "mon",
            type: "monitoring",
            laneId: "lane_monitoring",
            title: "Quality monitoring",
            metrics: ["Override rate", "Escalation rate", "Confidence"],
          },
        ],
        internalEdges: [
          { from: "agent", to: "validator" },
          { from: "validator", to: "approval" },
          { from: "approval", to: "mon" },
        ],
      },
    });
  }

  // Blueprint 3 — RAG knowledge layer, when the customer has documents/data.
  const hasKnowledge =
    (project.knowledgeBase?.totalChunks ?? 0) > 0 ||
    project.dataSources.length > 0;
  if (hasKnowledge) {
    out.push({
      id: "blueprint:rag-layer",
      scope: "workflow",
      patternFamily: "rag",
      title: "Ground the workflow in a RAG knowledge layer",
      rationale:
        "Retrieve from the customer's documents/data and feed grounded, cited context into the agents — cuts hallucination on policy- and knowledge-heavy steps.",
      insert: {
        connectFromSource: false,
        nodes: [
          {
            key: "retrieval",
            type: "data_retrieval",
            laneId: "lane_systems",
            title: "Knowledge retrieval",
            description:
              "Embeds the query and retrieves the most relevant source passages.",
          },
          {
            key: "rag",
            type: "ai_assist",
            laneId: "lane_ai",
            title: "RAG assistant",
            description:
              "Answers grounded in retrieved passages, with inline citations.",
            automationLevel: "draft_only",
            guardrails: ["Citation required", "Confidence threshold"],
          },
        ],
        internalEdges: [{ from: "retrieval", to: "rag" }],
      },
    });
  }

  return out;
}
