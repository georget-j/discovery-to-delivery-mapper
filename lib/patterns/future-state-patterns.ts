// Catalogue of automation patterns the future-state recommender is allowed
// to suggest. Each entry teaches the LLM when this pattern fits, what risks
// it usually introduces, and what FutureState enum value to set when the
// user applies it. Keeping the catalogue static (not LLM-generated) gives
// recommendations consistency, predictability, and grounding.

import type { AutomationPatternFamily, FutureState } from "@/lib/types";

export type AutomationPattern = {
  id: string;
  family: AutomationPatternFamily;
  name: string;
  shortDescription: string;
  whenToUse: string[];
  whenNotToUse: string[];
  exampleArchitecture: string;
  exampleRisks: string[];
  recommendedFutureState: FutureState;
};

export const PATTERNS: AutomationPattern[] = [
  {
    id: "single_agent_task",
    family: "agent",
    name: "Single-Agent Task Performer",
    shortDescription:
      "One AI agent executes a bounded operational task end-to-end.",
    whenToUse: [
      "Repetitive, well-bounded task",
      "Clear input/output contract",
      "Low downside if individual decisions are wrong",
    ],
    whenNotToUse: [
      "Irreversible action without a human checkpoint",
      "Heavy compliance or audit obligations",
    ],
    exampleArchitecture:
      "An agent receives the task input, calls a small set of tools (read system, write system, notify), and returns a structured result. No second-look layer.",
    exampleRisks: [
      "Model drift over time without monitoring",
      "Lack of audit trail for individual decisions",
    ],
    recommendedFutureState: "ai_assisted",
  },
  {
    id: "agent_with_validator",
    family: "agent_with_validator",
    name: "Agent + Validator (high-confidence pipeline)",
    shortDescription:
      "Primary agent does the work; a validator agent verifies above a confidence threshold.",
    whenToUse: [
      "High-volume decisioning with measurable confidence",
      "False-positive cost is meaningful",
      "Need a defensible second look without doubling human review",
    ],
    whenNotToUse: [
      "Tasks where confidence scores are noisy or absent",
      "Low-volume work where the validator overhead exceeds savings",
    ],
    exampleArchitecture:
      "Primary agent emits a result + confidence. If confidence ≥ threshold, validator agent re-derives independently and only passes if they agree. Below threshold → HITL fallback.",
    exampleRisks: [
      "Correlated errors between primary and validator if they share training data",
      "Threshold drift requires periodic recalibration",
    ],
    recommendedFutureState: "automated",
  },
  {
    id: "multi_agent_pipeline",
    family: "multi_agent",
    name: "Multi-Agent Pipeline",
    shortDescription:
      "Decompose the workflow into specialised agents that hand off to each other.",
    whenToUse: [
      "Multi-step, long-running workflow",
      "Each stage benefits from a different skill set or tool set",
      "Stage boundaries align with measurable artifacts",
    ],
    whenNotToUse: [
      "Workflow is essentially one decision",
      "Stages can't be defined without leaking context everywhere",
    ],
    exampleArchitecture:
      "Stage-1 agent (intake/triage) → Stage-2 agent (analysis) → Stage-3 agent (composition/output). Each stage exposes a structured artifact; an orchestrator manages retries and observability.",
    exampleRisks: [
      "Compounding error across stages",
      "Latency budget bloats without per-stage SLOs",
    ],
    recommendedFutureState: "automated",
  },
  {
    id: "rag_assistant",
    family: "rag",
    name: "RAG-Grounded Assistant",
    shortDescription:
      "Retrieval-augmented agent grounded in policy, playbooks, or knowledge bases.",
    whenToUse: [
      "Task is information-lookup heavy (policy, playbook, prior cases)",
      "Knowledge is updated regularly outside of the model",
      "Grounded answers reduce hallucination risk",
    ],
    whenNotToUse: [
      "Task requires creative synthesis beyond retrieved context",
      "Source corpus is unreliable or sparse",
    ],
    exampleArchitecture:
      "User/agent query → embed → retrieve top-K from vector store → augment prompt → LLM answer with inline citations. Source corpus indexed nightly.",
    exampleRisks: [
      "Stale or contradictory source documents",
      "Retrieval misses → confident-but-wrong answers",
    ],
    recommendedFutureState: "ai_assisted",
  },
  {
    id: "rules_with_ai_exception",
    family: "rules_plus_ai",
    name: "Rules-First with AI Exception Handling",
    shortDescription:
      "Deterministic rules handle the predictable majority; AI handles only the long tail.",
    whenToUse: [
      "Existing rules cover ~80% of cases",
      "Exception path is genuinely ambiguous, not just rare",
      "Compliance requires traceability for routine decisions",
    ],
    whenNotToUse: [
      "Rules don't yet exist or are inconsistent",
      "Exception volume is too low to justify a model",
    ],
    exampleArchitecture:
      "Rules engine evaluates first. On match → deterministic outcome. On miss/conflict → AI agent decides, logs reasoning, and routes for optional human review.",
    exampleRisks: [
      "Drift between rules and AI logic if not unified",
      "AI silently overruled by rules without telemetry",
    ],
    recommendedFutureState: "requires_approval",
  },
  {
    id: "hitl_review_gate",
    family: "hitl",
    name: "Human-in-the-Loop Review Gate",
    shortDescription: "AI drafts the artifact; a human approves before commit.",
    whenToUse: [
      "Customer-facing communications",
      "Material financial / legal / safety impact",
      "Onboarding phase before automation trust is built",
    ],
    whenNotToUse: [
      "Volume exceeds human review capacity",
      "Latency requirements rule out human checkpoints",
    ],
    exampleArchitecture:
      "Agent prepares the artifact, surfaces a side-by-side draft + rationale in a reviewer queue, awaits explicit approve/reject before the downstream action fires.",
    exampleRisks: [
      "Reviewer fatigue → rubber-stamping",
      "Queue backlog under volume spikes",
    ],
    recommendedFutureState: "requires_approval",
  },
  {
    id: "continuous_learning",
    family: "continuous_learning",
    name: "Continuous-Learning Loop",
    shortDescription:
      "Agent + feedback capture + retraining schedule for tasks where truth emerges over time.",
    whenToUse: [
      "Ground truth is observable later (e.g. dispositions, outcomes)",
      "Population drift is expected (seasonal, regulatory)",
      "Team can own the labeling + retraining cadence",
    ],
    whenNotToUse: [
      "No reliable feedback signal exists",
      "Team can't sustain labeling effort",
    ],
    exampleArchitecture:
      "Agent makes a decision → outcome captured asynchronously → labeled data flows back into evaluation harness → weekly/monthly model refresh under a champion-challenger pattern.",
    exampleRisks: [
      "Feedback bias if only failures are reviewed",
      "Operational complexity of running model lifecycle",
    ],
    recommendedFutureState: "ai_assisted",
  },
  {
    id: "copilot_side_by_side",
    family: "copilot",
    name: "Co-pilot Side-by-Side",
    shortDescription:
      "Agent suggests but never acts; the human stays in their flow with one-click apply.",
    whenToUse: [
      "Expert user prefers control (legal review, senior engineer)",
      "Subjective judgment is essential",
      "Low task volume per user but high stakes per decision",
    ],
    whenNotToUse: [
      "Throughput is the goal — co-pilot speeds up but doesn't scale",
      "User is junior and would over-rely on suggestions",
    ],
    exampleArchitecture:
      "Agent observes the user's working context and emits inline suggestions / completions / quality flags. The user retains full edit control; one-click apply commits suggestions into their working draft.",
    exampleRisks: [
      "Over-trust by junior users → silent quality drop",
      "Distraction from too many suggestions",
    ],
    recommendedFutureState: "human_led",
  },
];

export const PATTERN_BY_ID: Record<string, AutomationPattern> =
  Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

export const PATTERN_FAMILY_COLOR: Record<AutomationPatternFamily, string> = {
  agent: "bg-sky-100 text-sky-800 border-sky-200",
  agent_with_validator: "bg-emerald-100 text-emerald-800 border-emerald-200",
  multi_agent: "bg-violet-100 text-violet-800 border-violet-200",
  rag: "bg-teal-100 text-teal-800 border-teal-200",
  rules_plus_ai: "bg-amber-100 text-amber-800 border-amber-200",
  hitl: "bg-rose-100 text-rose-800 border-rose-200",
  continuous_learning: "bg-indigo-100 text-indigo-800 border-indigo-200",
  copilot: "bg-slate-100 text-slate-800 border-slate-200",
};

// Serialised form used inside the system prompt. Avoids inflating the prompt
// with the full type by hand-formatting the catalogue.
export function serializePatternsForPrompt(): string {
  return PATTERNS.map((p) => {
    return [
      `## ${p.name} (id: ${p.id}, family: ${p.family})`,
      p.shortDescription,
      `WHEN TO USE: ${p.whenToUse.map((w) => `• ${w}`).join("; ")}`,
      `WHEN NOT TO USE: ${p.whenNotToUse.map((w) => `• ${w}`).join("; ")}`,
      `ARCHITECTURE: ${p.exampleArchitecture}`,
      `TYPICAL RISKS: ${p.exampleRisks.map((r) => `• ${r}`).join("; ")}`,
      `FUTURE_STATE_ENUM: ${p.recommendedFutureState}`,
    ].join("\n");
  }).join("\n\n");
}
