// Deterministic clarifying questions the guided walkthrough asks at each stage.
// Keyed by node type so they're instant (no AI call); the answers are appended
// to the node's description so they inform later AI proposals and the output
// pack. A node's downstream context lightly tailors the prompts.

import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";

const BY_TYPE: Record<FutureWorkflowNodeType, string[]> = {
  human_action: [
    "Roughly how many of these happen per week, and what share are routine vs. judgment calls?",
    "What would a person need to see to trust an AI doing the routine ones?",
  ],
  system_action: [
    "Is this a clean API call, or does it need human glue today?",
    "What data goes in and what comes out of this step?",
  ],
  data_retrieval: [
    "Where does this data live, and how fresh does it need to be?",
    "Who owns access, and is any of it sensitive / regulated?",
  ],
  ai_assist: [
    "What should a person always check before trusting this suggestion?",
    "What inputs does it need, and where do they come from?",
  ],
  ai_agent: [
    "What's the confidence bar for this agent to act without a human?",
    "What does it pass downstream, and who consumes it?",
  ],
  guardrail: [
    "What exactly should this guardrail check, and what happens when it fails?",
  ],
  approval: [
    "Who signs off here, and what's their turnaround expectation?",
    "What information do they need to approve quickly?",
  ],
  decision_gate: ["What are the branches, and how is each one chosen?"],
  monitoring: [
    "Which metrics would prove this is working, and who watches them?",
  ],
  audit_log: [
    "What must be captured for compliance — decision, evidence, reviewer?",
  ],
  exception_path: [
    "What triggers this exception path, and where should it route?",
  ],
};

const AI_TYPES: FutureWorkflowNodeType[] = ["ai_assist", "ai_agent"];

function downstreamTypes(
  node: FutureWorkflowNode,
  map: FutureStateAIWorkflowMap,
): Set<FutureWorkflowNodeType> {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const out = new Set<FutureWorkflowNodeType>();
  for (const e of map.edges)
    if (e.source === node.id) {
      const t = byId.get(e.target);
      if (t) out.add(t.type);
    }
  return out;
}

export function stageQuestions(
  node: FutureWorkflowNode,
  map: FutureStateAIWorkflowMap,
): string[] {
  const base = BY_TYPE[node.type] ?? [
    "What does this stage do, and what does it hand off next?",
  ];
  const questions = [...base];

  // One context-aware nudge: an AI node with nothing checking it.
  if (
    AI_TYPES.includes(node.type) &&
    !downstreamTypes(node, map).has("guardrail")
  ) {
    questions.push(
      "Should a validator check this agent's output before it's used?",
    );
  }

  return questions.slice(0, 3);
}
