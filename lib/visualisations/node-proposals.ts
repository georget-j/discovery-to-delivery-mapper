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
import {
  SOLUTION_LIBRARY,
  ROLE_TO_NODE,
  ROLE_EDGE_LABEL,
  type MarketSolution,
} from "@/lib/patterns/solution-library";

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
  // The map node this proposal wants to anchor to. Set by the map-aware AI
  // path (moveToProposal) so AI ideas land wired into the RIGHT stage rather
  // than floating. Callers pass this as the apply source when present.
  preferredSourceNodeId?: string | null;
  insert: {
    nodes: ProposalNodeSpec[];
    // Wire an edge from the triggering node into the first inserted node.
    connectFromSource: boolean;
    // Label for the source→first-node edge (the data passed downstream).
    connectFromSourceLabel?: string;
    // Edges between inserted nodes, referenced by their `key`. When present,
    // these replace the default linear chaining of inserted nodes. `label`
    // names the data flowing along the edge.
    internalEdges?: { from: string; to: string; label?: string }[];
    // Wire an inserted node (by key) back into an existing map node by id —
    // lets a blueprint slot itself into the current flow.
    connectToExisting?: { fromKey: string; toNodeId: string; label?: string }[];
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

// ── Map-aware AI moves ──────────────────────────────────────────────────────
// The shape /api/recommend/map-moves returns: each move names an EXISTING map
// node to anchor to (sourceNodeId) plus the nodes/edges to insert. Turning it
// into a NodeProposal with preferredSourceNodeId is what makes "Ask AI for
// ideas" land wired into the right stage instead of floating.

export type MapMove = {
  id: string;
  sourceNodeId: string | null;
  patternFamily: AutomationPatternFamily;
  title: string;
  rationale: string;
  insert: {
    nodes: {
      key: string;
      type: FutureWorkflowNodeType;
      laneId: string;
      title: string;
      description?: string;
    }[];
    internalEdges?: { from: string; to: string; label?: string }[];
    connectFromSource?: boolean;
    connectFromSourceLabel?: string;
    connectToExisting?: { fromKey: string; toNodeId: string; label?: string }[];
  };
};

export function moveToProposal(move: MapMove): NodeProposal {
  const hasSource = !!move.sourceNodeId;
  return {
    id: `ai:${move.id}`,
    title: move.title,
    rationale: move.rationale,
    patternFamily: move.patternFamily,
    scope: "node",
    preferredSourceNodeId: move.sourceNodeId,
    insert: {
      nodes: move.insert.nodes.map((n) => ({
        key: n.key,
        type: n.type,
        laneId: n.laneId,
        title: n.title,
        description: n.description,
        ...blueprintNodeExtras(n.type),
      })),
      connectFromSource: move.insert.connectFromSource ?? hasSource,
      connectFromSourceLabel: move.insert.connectFromSourceLabel,
      internalEdges: move.insert.internalEdges,
      connectToExisting: move.insert.connectToExisting,
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
        connectFromSourceLabel: "input",
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
        connectFromSourceLabel: "draft output",
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
        connectFromSourceLabel: "decisions + confidence",
        nodes: [
          {
            key: "mon",
            type: "monitoring",
            laneId: "lane_monitoring",
            title: "Quality monitoring",
            description:
              "Tracks confidence, human-override rate, and drift over time.",
            metrics: ["Override rate", "Confidence distribution", "Drift"],
          },
          {
            key: "audit",
            type: "audit_log",
            laneId: "lane_monitoring",
            title: "Audit log",
            description: "Immutable record of each decision + evidence used.",
            auditEvents: ["Decision", "Evidence", "Reviewer"],
          },
        ],
        internalEdges: [{ from: "mon", to: "audit", label: "logged" }],
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
        connectFromSourceLabel: "for sign-off",
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

// ── Whole-workflow blueprints (from the market solution library) ────────────
// Multi-node sub-graphs that restructure the flow rather than appending a
// single node — "how should the WHOLE workflow change". Each is derived from a
// real market solution in lib/patterns/solution-library.ts, broken into
// step-by-step functions, and carries scope:"workflow" so the rail headlines
// it under "Transform the workflow".

// AI-ish node types get sensible automation defaults so the inserted nodes
// look right without per-step boilerplate in the library.
function blueprintNodeExtras(
  type: ProposalNodeSpec["type"],
): Partial<ProposalNodeSpec> {
  if (type === "ai_agent")
    return {
      automationLevel: "autonomous_with_guardrails",
      guardrails: ["Confidence threshold"],
    };
  if (type === "ai_assist")
    return { automationLevel: "draft_only", requiredHumanApproval: true };
  if (type === "approval") return { requiredHumanApproval: true };
  return {};
}

// Turn a market solution into an applyable workflow blueprint proposal: each
// step becomes a node (keyed by index), and the solution's flow becomes the
// internal edges.
export function solutionToBlueprint(solution: MarketSolution): NodeProposal {
  const nodes: ProposalNodeSpec[] = solution.steps.map((step, i) => {
    const mapped = ROLE_TO_NODE[step.role];
    return {
      key: `s${i}`,
      type: mapped.type,
      laneId: mapped.laneId,
      title: step.name,
      description: step.description,
      ...blueprintNodeExtras(mapped.type),
    };
  });
  const internalEdges = solution.flow.map((e) => ({
    from: `s${e.from}`,
    to: `s${e.to}`,
    label: ROLE_EDGE_LABEL[solution.steps[e.from]?.role] ?? undefined,
  }));
  return {
    id: `blueprint:${solution.id}`,
    scope: "workflow",
    patternFamily: solution.family,
    title: solution.name,
    rationale: solution.summary,
    insert: { nodes, connectFromSource: false, internalEdges },
  };
}

// Every market solution as a blueprint — useful for a "browse the library" UI
// and for tests.
export function allSolutionBlueprints(): NodeProposal[] {
  return SOLUTION_LIBRARY.map(solutionToBlueprint);
}

// ── "Already implemented?" detection ────────────────────────────────────────
// A solution is considered already implemented when the map already contains a
// node of every node-type the solution would introduce — i.e. you already have
// all of its tool types in place. Concrete + deterministic, and it lets the
// rail update itself: as the user applies blueprints / adds nodes, solutions
// whose pieces are all present drop out of the suggestions.
//
// audit_log counts as monitoring, and ai_agent satisfies an ai_assist
// requirement (an agent is a superset of an assist), so we don't keep
// suggesting a tool the user has effectively already covered.
function typeSatisfied(
  needed: FutureWorkflowNodeType,
  present: Set<FutureWorkflowNodeType>,
): boolean {
  if (present.has(needed)) return true;
  if (needed === "monitoring" && present.has("audit_log")) return true;
  if (needed === "audit_log" && present.has("monitoring")) return true;
  if (needed === "ai_assist" && present.has("ai_agent")) return true;
  return false;
}

export function solutionNodeTypes(
  solution: MarketSolution,
): Set<FutureWorkflowNodeType> {
  return new Set(solution.steps.map((s) => ROLE_TO_NODE[s.role].type));
}

export function isSolutionImplemented(
  solution: MarketSolution,
  map: FutureStateAIWorkflowMap,
): boolean {
  const present = new Set<FutureWorkflowNodeType>(map.nodes.map((n) => n.type));
  const need = solutionNodeTypes(solution);
  if (need.size === 0) return false;
  return [...need].every((t) => typeSatisfied(t, present));
}

// Context-aware ordering: surface the most relevant market solutions for THIS
// project first. RAG solutions only appear when the customer actually has
// documents/data; safety solutions are boosted under regulatory context.
export function proposeWorkflowBlueprints(
  map: FutureStateAIWorkflowMap,
  project: OnboardingProject,
): NodeProposal[] {
  // Nothing to transform on an empty map.
  if (map.nodes.length === 0) return [];
  const hasKnowledge =
    (project.knowledgeBase?.totalChunks ?? 0) > 0 ||
    project.dataSources.length > 0;
  const regulated = (project.customer.regulatoryContext?.length ?? 0) > 0;

  const relevant = SOLUTION_LIBRARY.filter((s) => {
    if (s.category === "rag" && !hasKnowledge) return false;
    // Don't re-suggest a tool/pattern the workflow already implements — the
    // rail updates itself as the user builds the map out.
    if (isSolutionImplemented(s, map)) return false;
    return true;
  });

  // Priority: a generally-useful core leads, then the rest. Safety patterns
  // jump up when the engagement is regulated.
  const corePriority = [
    "orchestrator-workers",
    "evaluator-optimizer",
    "supervisor-manager",
    "routing",
    "prompt-chaining",
    "plan-and-execute",
  ];
  const score = (s: MarketSolution): number => {
    let n = corePriority.indexOf(s.id);
    if (n === -1) n = corePriority.length + SOLUTION_LIBRARY.indexOf(s);
    if (regulated && s.category === "safety") n -= 100;
    if (hasKnowledge && s.category === "rag") n -= 50;
    return n;
  };

  return relevant
    .slice()
    .sort((a, b) => score(a) - score(b))
    .slice(0, 8)
    .map(solutionToBlueprint);
}
