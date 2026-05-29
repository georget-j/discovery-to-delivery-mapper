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
export type ProposalNodeSpec = Omit<FutureWorkflowNode, "id" | "position">;

export type NodeProposal = {
  id: string; // stable per (sourceNode, rule) so dismissals/keys are stable
  title: string;
  rationale: string;
  patternFamily: AutomationPatternFamily;
  insert: {
    nodes: ProposalNodeSpec[];
    // Wire an edge from the triggering node into the first inserted node.
    connectFromSource: boolean;
  };
};

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

  // Map-level gaps come first so they read as the headline.
  const mapProposals: NodeProposal[] = [];
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
