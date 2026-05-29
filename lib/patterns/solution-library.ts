// ────────────────────────────────────────────────────────────────────────────
// Market AI-automation solution library.
//
// A curated repository of the AI workflow / agentic architectures currently
// used in the market, each broken down into step-by-step functions. The steps
// map onto the future-state workflow node model, so every solution here can be
// surfaced as an applyable blueprint in the workflow canvas (see
// lib/visualisations/node-proposals.ts → solutionToBlueprint).
//
// Sources (researched 2026-05):
//   • Anthropic — "Building Effective Agents"
//     https://www.anthropic.com/research/building-effective-agents
//     (prompt chaining, routing, parallelization, orchestrator-workers,
//      evaluator-optimizer, autonomous agents)
//   • OpenAI — "A Practical Guide to Building Agents"
//     https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
//     (single-agent loop, manager pattern, decentralized handoff, guardrails)
//   • LangGraph / LangChain — multi-agent architectures
//     https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/
//     (supervisor, hierarchical teams, network, scatter-gather)
//   • Widely-documented RAG + reasoning patterns (naive/advanced/agentic RAG,
//     ReAct, Reflexion, plan-and-execute).
// ────────────────────────────────────────────────────────────────────────────

import type { AutomationPatternFamily } from "@/lib/types";
import type { FutureWorkflowNodeType } from "@/lib/visualisations/workflow-types";

// The role a step plays. Drives which workflow node type + lane it maps to.
export type SolutionStepRole =
  | "orchestrator" // plans + delegates (multi-agent coordinator)
  | "router" // classifies + routes to a branch
  | "agent" // does the work autonomously
  | "assist" // drafts / suggests, human-in-control
  | "retrieval" // fetches knowledge / data
  | "tool" // calls a system / API
  | "validator" // independently checks an output
  | "evaluator" // scores an output, drives an improve loop
  | "guardrail" // policy / safety check
  | "human" // human review / approval
  | "aggregator" // merges parallel results
  | "monitor"; // telemetry / feedback in production

export type SolutionStep = {
  name: string; // "Classify intent"
  role: SolutionStepRole;
  description: string; // what this step does, concretely
};

export type SolutionCategory =
  | "workflow" // deterministic orchestration (Anthropic workflows)
  | "multi_agent" // multiple coordinated agents
  | "rag" // retrieval-augmented generation
  | "reasoning" // agent reasoning loops
  | "safety"; // guardrail / evaluation layers

export type MarketSolution = {
  id: string;
  name: string;
  family: AutomationPatternFamily;
  category: SolutionCategory;
  source: string;
  sourceUrl: string;
  summary: string;
  whenToUse: string[];
  steps: SolutionStep[];
  // Edges between steps, by 0-based step index. Defines the flow shape.
  flow: { from: number; to: number }[];
};

// Map a step role → the future-state workflow node type + lane it becomes when
// a solution is materialised as a blueprint on the canvas.
export const ROLE_TO_NODE: Record<
  SolutionStepRole,
  { type: FutureWorkflowNodeType; laneId: string }
> = {
  orchestrator: { type: "ai_agent", laneId: "lane_ai" },
  router: { type: "ai_assist", laneId: "lane_ai" },
  agent: { type: "ai_agent", laneId: "lane_ai" },
  assist: { type: "ai_assist", laneId: "lane_ai" },
  retrieval: { type: "data_retrieval", laneId: "lane_systems" },
  tool: { type: "system_action", laneId: "lane_systems" },
  validator: { type: "guardrail", laneId: "lane_guardrails" },
  evaluator: { type: "guardrail", laneId: "lane_guardrails" },
  guardrail: { type: "guardrail", laneId: "lane_guardrails" },
  human: { type: "approval", laneId: "lane_compliance" },
  aggregator: { type: "ai_agent", laneId: "lane_ai" },
  monitor: { type: "monitoring", laneId: "lane_monitoring" },
};

// Short edge label describing what a step of this role passes downstream — so
// blueprint edges read as data flowing between agents ("draft →", "context →").
export const ROLE_EDGE_LABEL: Record<SolutionStepRole, string> = {
  orchestrator: "subtask",
  router: "routed",
  agent: "output",
  assist: "draft",
  retrieval: "context",
  tool: "result",
  validator: "checked",
  evaluator: "score",
  guardrail: "passed",
  human: "approved",
  aggregator: "result",
  monitor: "metrics",
};

// Linear flow helper — chains steps 0→1→2→…
const chain = (n: number) =>
  Array.from({ length: n - 1 }, (_, i) => ({ from: i, to: i + 1 }));

const ANTHROPIC = "Anthropic — Building Effective Agents";
const ANTHROPIC_URL =
  "https://www.anthropic.com/research/building-effective-agents";
const OPENAI = "OpenAI — A Practical Guide to Building Agents";
const OPENAI_URL =
  "https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/";
const LANGGRAPH = "LangGraph — Multi-Agent Architectures";
const LANGGRAPH_URL =
  "https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/";
const COMMUNITY = "Widely-documented pattern";
const RAG_URL = "https://www.anthropic.com/research/building-effective-agents";

export const SOLUTION_LIBRARY: MarketSolution[] = [
  // ── Workflows (Anthropic) ────────────────────────────────────────────────
  {
    id: "prompt-chaining",
    name: "Prompt Chaining",
    family: "multi_agent",
    category: "workflow",
    source: ANTHROPIC,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "Decompose a task into a fixed sequence of LLM calls, each operating on the previous step's output, with a programmatic gate between stages.",
    whenToUse: [
      "The task cleanly splits into fixed sequential subtasks",
      "Each step is simpler / more accurate than doing it all at once",
    ],
    steps: [
      {
        name: "Step 1 — draft",
        role: "agent",
        description:
          "First LLM call produces an initial artifact from the input.",
      },
      {
        name: "Gate / check",
        role: "validator",
        description:
          "Programmatic check that the intermediate output meets criteria before continuing.",
      },
      {
        name: "Step 2 — refine",
        role: "agent",
        description:
          "Second LLM call transforms the checked output toward the goal.",
      },
      {
        name: "Step 3 — finalise",
        role: "agent",
        description: "Final LLM call produces the finished result.",
      },
    ],
    flow: chain(4),
  },
  {
    id: "routing",
    name: "Routing",
    family: "rules_plus_ai",
    category: "workflow",
    source: ANTHROPIC,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "Classify the input, then route it to a specialised follow-on handler — letting you optimise each path separately.",
    whenToUse: [
      "Distinct input categories are better handled by different prompts/tools",
      "Classification can be done accurately up front",
    ],
    steps: [
      {
        name: "Classify intent",
        role: "router",
        description: "Classifier determines the input category.",
      },
      {
        name: "Specialist A",
        role: "agent",
        description: "Handler tuned for category A.",
      },
      {
        name: "Specialist B",
        role: "agent",
        description: "Handler tuned for category B.",
      },
      {
        name: "Fallback / escalate",
        role: "human",
        description:
          "Low-confidence or unknown categories escalate to a human.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 0, to: 3 },
    ],
  },
  {
    id: "parallelization",
    name: "Parallelization (sectioning + voting)",
    family: "multi_agent",
    category: "workflow",
    source: ANTHROPIC,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "Run independent subtasks (or the same task multiple times) in parallel, then aggregate — for speed or for higher confidence via voting.",
    whenToUse: [
      "Subtasks are independent and can run concurrently",
      "Multiple attempts / perspectives improve confidence",
    ],
    steps: [
      {
        name: "Split task",
        role: "orchestrator",
        description:
          "Divide the work into independent sections (or N attempts).",
      },
      {
        name: "Worker A",
        role: "agent",
        description: "Handles section A in parallel.",
      },
      {
        name: "Worker B",
        role: "agent",
        description: "Handles section B in parallel.",
      },
      {
        name: "Aggregate / vote",
        role: "aggregator",
        description: "Combine results or take a majority vote.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
    ],
  },
  {
    id: "orchestrator-workers",
    name: "Orchestrator–Workers",
    family: "multi_agent",
    category: "multi_agent",
    source: ANTHROPIC,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "A central orchestrator dynamically breaks the task into subtasks at runtime, delegates each to a worker agent, and synthesises the results.",
    whenToUse: [
      "Subtasks can't be predicted up front — they depend on the input",
      "Complex tasks needing dynamic decomposition",
    ],
    steps: [
      {
        name: "Orchestrator",
        role: "orchestrator",
        description: "Plans the task and decides which workers to spawn.",
      },
      {
        name: "Worker — analysis",
        role: "agent",
        description: "Specialist agent for the analysis subtask.",
      },
      {
        name: "Worker — drafting",
        role: "agent",
        description: "Specialist agent for the drafting subtask.",
      },
      {
        name: "Synthesise",
        role: "aggregator",
        description:
          "Orchestrator merges worker outputs into the final result.",
      },
      {
        name: "Monitoring",
        role: "monitor",
        description:
          "Tracks per-worker confidence + override rate in production.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },
  {
    id: "evaluator-optimizer",
    name: "Evaluator–Optimizer",
    family: "agent_with_validator",
    category: "workflow",
    source: ANTHROPIC,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "A generator produces an output; an evaluator scores it against criteria and returns feedback; the generator revises in a loop until it passes.",
    whenToUse: [
      "Clear evaluation criteria exist",
      "Iterative refinement measurably improves the result",
    ],
    steps: [
      {
        name: "Generate",
        role: "agent",
        description: "Produce a candidate output.",
      },
      {
        name: "Evaluate",
        role: "evaluator",
        description:
          "Score against criteria; accept or return actionable feedback.",
      },
      {
        name: "Revise (loop)",
        role: "agent",
        description: "Apply the feedback and regenerate; loop until accepted.",
      },
      {
        name: "Final output",
        role: "aggregator",
        description: "Emit the accepted result.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 1 },
      { from: 1, to: 3 },
    ],
  },
  {
    id: "autonomous-agent",
    name: "Autonomous Agent (tool loop)",
    family: "agent",
    category: "reasoning",
    source: ANTHROPIC,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "A single agent runs in a loop — plan, call a tool, observe the result, repeat — until the goal is met, with a human checkpoint on consequential actions.",
    whenToUse: [
      "Open-ended tasks where the number of steps can't be predicted",
      "The agent can verify progress from environment feedback",
    ],
    steps: [
      {
        name: "Plan",
        role: "agent",
        description: "Agent reasons about the next action toward the goal.",
      },
      {
        name: "Act (tool call)",
        role: "tool",
        description: "Execute a tool / API call.",
      },
      {
        name: "Observe",
        role: "agent",
        description: "Read the result and decide whether to continue the loop.",
      },
      {
        name: "Human checkpoint",
        role: "human",
        description:
          "Pause for approval before consequential / irreversible actions.",
      },
      {
        name: "Monitoring",
        role: "monitor",
        description: "Telemetry on tool use, cost, and stop conditions.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 0 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },
  // ── Multi-agent (OpenAI / LangGraph) ──────────────────────────────────────
  {
    id: "supervisor-manager",
    name: "Supervisor / Manager",
    family: "multi_agent",
    category: "multi_agent",
    source: OPENAI,
    sourceUrl: OPENAI_URL,
    summary:
      "A central manager agent calls specialised agents as tools, keeping context and control while delegating, then synthesises a unified response.",
    whenToUse: [
      "One coordinator should own context + the user-facing response",
      "Specialist capabilities should be available on demand",
    ],
    steps: [
      {
        name: "Manager",
        role: "orchestrator",
        description: "Owns the conversation; decides which specialist to call.",
      },
      {
        name: "Specialist — research",
        role: "agent",
        description: "Called as a tool for research subtasks.",
      },
      {
        name: "Specialist — action",
        role: "agent",
        description: "Called as a tool to perform an action.",
      },
      {
        name: "Synthesise reply",
        role: "aggregator",
        description: "Manager composes the unified response.",
      },
      {
        name: "Output guardrail",
        role: "guardrail",
        description: "Checks the response for policy / safety before it ships.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },
  {
    id: "hierarchical-teams",
    name: "Hierarchical Agent Teams",
    family: "multi_agent",
    category: "multi_agent",
    source: LANGGRAPH,
    sourceUrl: LANGGRAPH_URL,
    summary:
      "A top-level supervisor coordinates mid-level supervisors, each owning a team of worker agents — for workflows too big for a single coordinator.",
    whenToUse: [
      "Many specialists across distinct domains",
      "A single supervisor would have too large a context / span",
    ],
    steps: [
      {
        name: "Top supervisor",
        role: "orchestrator",
        description: "Routes work to the right team.",
      },
      {
        name: "Team A supervisor",
        role: "orchestrator",
        description: "Coordinates team A's workers.",
      },
      {
        name: "Team A workers",
        role: "agent",
        description: "Execute team A's subtasks.",
      },
      {
        name: "Team B supervisor",
        role: "orchestrator",
        description: "Coordinates team B's workers.",
      },
      {
        name: "Team B workers",
        role: "agent",
        description: "Execute team B's subtasks.",
      },
      {
        name: "Synthesise",
        role: "aggregator",
        description: "Top supervisor merges team outputs.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 0, to: 3 },
      { from: 3, to: 4 },
      { from: 2, to: 5 },
      { from: 4, to: 5 },
    ],
  },
  {
    id: "decentralized-handoff",
    name: "Decentralized Handoff (Swarm-style)",
    family: "multi_agent",
    category: "multi_agent",
    source: OPENAI,
    sourceUrl: OPENAI_URL,
    summary:
      "Peer agents hand off control of the workflow to one another based on the task at hand — no central coordinator.",
    whenToUse: [
      "Conversation naturally moves between specialised domains",
      "No single agent should own the whole flow",
    ],
    steps: [
      {
        name: "Triage agent",
        role: "router",
        description: "Receives the request and hands off to the right peer.",
      },
      {
        name: "Billing agent",
        role: "agent",
        description: "Owns the flow for billing tasks; can hand back / on.",
      },
      {
        name: "Support agent",
        role: "agent",
        description: "Owns the flow for support tasks; can hand back / on.",
      },
      {
        name: "Output guardrail",
        role: "guardrail",
        description: "Final safety / policy check on the response.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
    ],
  },
  // ── RAG ───────────────────────────────────────────────────────────────────
  {
    id: "rag-naive",
    name: "RAG — Retrieve & Generate",
    family: "rag",
    category: "rag",
    source: COMMUNITY,
    sourceUrl: RAG_URL,
    summary:
      "Embed the query, retrieve the most relevant passages from a vector store, and generate an answer grounded in them.",
    whenToUse: [
      "Knowledge-lookup tasks over a document corpus",
      "Answers must be grounded in source material",
    ],
    steps: [
      {
        name: "Retrieve",
        role: "retrieval",
        description: "Embed the query and fetch top-K passages.",
      },
      {
        name: "Generate (grounded)",
        role: "assist",
        description: "Answer using only the retrieved context, with citations.",
      },
      {
        name: "Citation guardrail",
        role: "guardrail",
        description: "Reject answers lacking a supporting citation.",
      },
    ],
    flow: chain(3),
  },
  {
    id: "rag-advanced",
    name: "Advanced RAG (rewrite + re-rank)",
    family: "rag",
    category: "rag",
    source: COMMUNITY,
    sourceUrl: RAG_URL,
    summary:
      "Rewrite the query for retrieval, fetch a wide candidate set, re-rank for relevance, then generate a grounded, cited answer.",
    whenToUse: [
      "Naive retrieval misses relevant passages",
      "Precision matters and you can afford a re-rank step",
    ],
    steps: [
      {
        name: "Query rewrite",
        role: "assist",
        description: "Expand / rephrase the query for better recall.",
      },
      {
        name: "Retrieve",
        role: "retrieval",
        description: "Fetch a wide candidate set of passages.",
      },
      {
        name: "Re-rank",
        role: "tool",
        description: "Score candidates with a cross-encoder; keep the best.",
      },
      {
        name: "Generate (grounded)",
        role: "assist",
        description: "Answer from the re-ranked context, with citations.",
      },
      {
        name: "Citation guardrail",
        role: "guardrail",
        description: "Verify every claim is supported.",
      },
    ],
    flow: chain(5),
  },
  {
    id: "rag-agentic",
    name: "Agentic RAG",
    family: "rag",
    category: "rag",
    source: COMMUNITY,
    sourceUrl: RAG_URL,
    summary:
      "An agent decides when and what to retrieve, runs multiple retrieval+reason cycles, and a validator checks the grounded answer before it ships.",
    whenToUse: [
      "Multi-hop questions needing several retrieval rounds",
      "The agent must decide which source to query",
    ],
    steps: [
      {
        name: "Plan retrieval",
        role: "agent",
        description: "Decide what to look up and where.",
      },
      {
        name: "Retrieve",
        role: "retrieval",
        description: "Fetch passages for the current sub-question.",
      },
      {
        name: "Reason / loop",
        role: "agent",
        description: "Decide whether more retrieval is needed; loop if so.",
      },
      {
        name: "Validate answer",
        role: "validator",
        description: "Check the grounded answer for support + completeness.",
      },
      {
        name: "Monitoring",
        role: "monitor",
        description: "Track retrieval hit-rate and answer quality.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 1 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },
  // ── Reasoning ───────────────────────────────────────────────────────────
  {
    id: "react",
    name: "ReAct (reason + act)",
    family: "agent",
    category: "reasoning",
    source: COMMUNITY,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "Interleave reasoning and tool use: the agent thinks, takes an action, observes the result, and repeats until it can answer.",
    whenToUse: [
      "Tasks needing live tool/data lookups mid-reasoning",
      "The path to the answer is not known up front",
    ],
    steps: [
      {
        name: "Reason",
        role: "agent",
        description: "Think about what's needed next.",
      },
      {
        name: "Act (tool)",
        role: "tool",
        description: "Call a tool to gather information or take a step.",
      },
      {
        name: "Observe",
        role: "agent",
        description: "Incorporate the result; decide to loop or finish.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 0 },
    ],
  },
  {
    id: "reflexion",
    name: "Reflexion (self-critique)",
    family: "agent_with_validator",
    category: "reasoning",
    source: COMMUNITY,
    sourceUrl: ANTHROPIC_URL,
    summary:
      "The agent attempts the task, critiques its own output against the goal, and retries with the self-feedback as added context.",
    whenToUse: [
      "Quality lifts measurably with a self-review pass",
      "No external evaluator is available",
    ],
    steps: [
      {
        name: "Attempt",
        role: "agent",
        description: "Produce a first attempt.",
      },
      {
        name: "Self-critique",
        role: "evaluator",
        description: "Reflect on errors / gaps against the goal.",
      },
      {
        name: "Retry with feedback",
        role: "agent",
        description: "Redo the task using the critique; loop if needed.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 1 },
    ],
  },
  {
    id: "plan-and-execute",
    name: "Plan-and-Execute",
    family: "multi_agent",
    category: "reasoning",
    source: COMMUNITY,
    sourceUrl: LANGGRAPH_URL,
    summary:
      "A planner produces a multi-step plan up front; an executor runs each step; a replanner adjusts the remaining plan as results come in.",
    whenToUse: [
      "Long-horizon tasks that benefit from an explicit plan",
      "Cost matters — plan once, execute many",
    ],
    steps: [
      {
        name: "Planner",
        role: "orchestrator",
        description: "Produce an ordered plan of steps.",
      },
      {
        name: "Executor",
        role: "agent",
        description: "Execute the current step (often with tools).",
      },
      {
        name: "Replan",
        role: "orchestrator",
        description: "Update the remaining plan based on results; loop.",
      },
      {
        name: "Finalise",
        role: "aggregator",
        description: "Assemble the final result once the plan completes.",
      },
    ],
    flow: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 1 },
      { from: 2, to: 3 },
    ],
  },
  // ── Safety / ops (cross-cutting) ──────────────────────────────────────────
  {
    id: "guardrails-hitl",
    name: "Guardrails + Human-in-the-Loop",
    family: "hitl",
    category: "safety",
    source: OPENAI,
    sourceUrl: OPENAI_URL,
    summary:
      "Wrap an agent in an input guardrail (validate / sanitise), an output guardrail (policy / safety), and a human approval gate for consequential actions.",
    whenToUse: [
      "Regulated, customer-facing, or high-impact actions",
      "You need defensible safety controls around the model",
    ],
    steps: [
      {
        name: "Input guardrail",
        role: "guardrail",
        description:
          "Validate / sanitise / classify the request before the agent sees it.",
      },
      { name: "Agent", role: "agent", description: "Performs the task." },
      {
        name: "Output guardrail",
        role: "guardrail",
        description: "Check the output for policy, PII, and safety.",
      },
      {
        name: "Human approval",
        role: "human",
        description: "Sign off consequential actions before they commit.",
      },
      {
        name: "Audit log",
        role: "monitor",
        description: "Immutable record of decision + evidence + reviewer.",
      },
    ],
    flow: chain(5),
  },
  {
    id: "llm-as-judge",
    name: "LLM-as-Judge Evaluation Loop",
    family: "continuous_learning",
    category: "safety",
    source: COMMUNITY,
    sourceUrl: OPENAI_URL,
    summary:
      "Continuously score live outputs with an LLM judge against a rubric, feed failures into monitoring, and route low scores to human review.",
    whenToUse: [
      "You need ongoing quality assurance in production",
      "Ground-truth labels arrive late or never",
    ],
    steps: [
      {
        name: "Capture output",
        role: "monitor",
        description: "Sample live agent outputs.",
      },
      {
        name: "LLM judge",
        role: "evaluator",
        description: "Score against a rubric; flag low scores.",
      },
      {
        name: "Human review (low scores)",
        role: "human",
        description: "Escalate flagged cases for labelling.",
      },
      {
        name: "Monitoring dashboard",
        role: "monitor",
        description: "Track score distribution + drift over time.",
      },
    ],
    flow: chain(4),
  },
];

export const SOLUTION_BY_ID: Record<string, MarketSolution> =
  Object.fromEntries(SOLUTION_LIBRARY.map((s) => [s.id, s]));

export function solutionsByCategory(
  category: SolutionCategory,
): MarketSolution[] {
  return SOLUTION_LIBRARY.filter((s) => s.category === category);
}
