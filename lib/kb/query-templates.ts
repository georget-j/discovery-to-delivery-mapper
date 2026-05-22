// Per-target retrieval queries used when populating downstream tabs from
// the knowledge base. Kept small + specific so cosine similarity returns
// chunks that actually anchor each section's purpose.

export type GenerationTarget =
  | "discovery"
  | "workflows"
  | "systems"
  | "stakeholders"
  | "risks"
  | "all";

export const QUERY_TEMPLATES: Record<
  Exclude<GenerationTarget, "all">,
  string
> = {
  discovery:
    "Customer business problem, primary use case, current process, success criteria, sponsoring team, regulatory context, implementation deadline.",
  workflows:
    "End-to-end process steps the customer performs. Systems used, owner teams, frequency, manual effort, pain points, failure modes.",
  systems:
    "Software systems, platforms, integrations the customer uses. Access methods, data sensitivity, ownership, authentication.",
  stakeholders:
    "People involved in the project. Roles, teams, concerns, decision-making authority, sponsorship, technical ownership.",
  risks:
    "Deployment risks, compliance constraints, integration challenges, adoption blockers, security concerns, model quality concerns.",
};

// For target="all", we run every query and dedupe chunk ids before passing
// the combined context to a single AI call.
export function queriesForTarget(target: GenerationTarget): string[] {
  if (target === "all") return Object.values(QUERY_TEMPLATES);
  return [QUERY_TEMPLATES[target]];
}
