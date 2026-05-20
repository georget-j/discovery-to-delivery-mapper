import type { OnboardingProject } from "./types";

// Prompt version — bump when the prompt changes meaningfully. Used in stored
// artifact metadata so we can invalidate cached outputs after a prompt edit.
export const ARTIFACT_PROMPT_VERSION = "2";

const SYSTEM_PROMPT = `You are an expert forward-deployed AI engineer and solutions architect at an early-stage AI startup.

Your role is to produce structured, professional onboarding documentation for enterprise customers deploying an AI product. You have deep knowledge of enterprise software procurement, AI deployment risk, change management, and technical integration.

Voice: clear, direct, professional. No hedging, no filler phrases ("we believe", "it is important to note"), no marketing language. Be specific to the customer context.

Format: each artifact is markdown. Use ## headers for sections, - for bullet points, > for callouts, and tables when comparing items. Aim for scannable structure over walls of prose.`;

function serializeProject(project: OnboardingProject): string {
  return JSON.stringify({
    customer: project.customer,
    discovery: project.discovery,
    workflows: project.workflows.map((w) => ({
      name: w.name,
      description: w.description,
      ownerTeam: w.ownerTeam,
      currentSystem: w.currentSystem,
      manualEffort: w.manualEffort,
      frequency: w.frequency,
      automationPotential: w.automationPotential,
      futureState: w.futureState,
      painPoints: w.painPoints,
      failureModes: w.failureModes,
    })),
    systems: project.systems.map((s) => ({
      name: s.name,
      type: s.type,
      apiAvailable: s.apiAvailable,
      dataSensitivity: s.dataSensitivity,
      integrationComplexity: s.integrationComplexity,
    })),
    dataSources: project.dataSources.map((d) => ({
      name: d.name,
      dataType: d.dataType,
      quality: d.quality,
      pii: d.pii,
      accessStatus: d.accessStatus,
    })),
    stakeholders: project.stakeholders,
    // Cap at 8 to keep token usage predictable on large risk registers;
    // generation still gets the most-severe risks since the engine surfaces
    // them by severity.
    risks: project.risks.slice(0, 8),
    pilotPlan: project.pilotPlan,
    ...(project.meetingNotes ? { meetingNotes: project.meetingNotes } : {}),
  }, null, 2);
}

// All 15 artifact keys with a one-line description of the audience + purpose.
// Single source of truth — referenced in the prompt body and assertable in tests.
export const ARTIFACT_SPECS: { key: string; audience: string; purpose: string }[] = [
  { key: "customerDiscoverySummary",    audience: "internal handoff team",   purpose: "what was learned in discovery, in 5 minutes" },
  { key: "currentStateWorkflow",        audience: "engineering + product",   purpose: "how the customer works today, with pain points" },
  { key: "futureStateWorkflow",         audience: "customer executive",      purpose: "the AI-augmented operating model post-deployment" },
  { key: "requirementsMatrix",          audience: "engineering",             purpose: "must-have requirements with priority and owner" },
  { key: "missingInformationLog",       audience: "CSM + customer",          purpose: "open gaps with named owners to resolve" },
  { key: "integrationAndApiPlan",       audience: "engineering",             purpose: "every integration, scoped and risk-rated" },
  { key: "dataReadinessAssessment",     audience: "data + engineering",      purpose: "whether the data can carry the AI" },
  { key: "implementationPlan",          audience: "customer + internal",     purpose: "phased delivery from kick-off through rollout" },
  { key: "riskRegisterSummary",         audience: "customer executive",      purpose: "key deployment risks with mitigations" },
  { key: "pilotSuccessPlan",            audience: "customer",                purpose: "what 'pilot success' means, measurably" },
  { key: "stakeholderCommunicationPlan", audience: "CSM",                    purpose: "who hears what during the deployment" },
  { key: "engineeringHandoff",          audience: "engineering",             purpose: "everything engineering needs on day one" },
  { key: "productFeedbackMemo",         audience: "product",                 purpose: "gaps and friction this engagement revealed" },
  { key: "executiveSummary",            audience: "customer C-suite",        purpose: "one-page sign-off doc" },
  { key: "nextActionsChecklist",        audience: "CSM + customer",          purpose: "named-owner actions for the next 2 weeks" },
];

export function buildArtifactPrompt(project: OnboardingProject): { system: string; user: string } {
  // Concrete one-artifact example anchors the model on format + tone + citation style.
  // Using a generic ACME example to avoid biasing toward this project's data.
  const FEW_SHOT_EXAMPLE = `Example (executiveSummary for a generic customer):

## Opportunity

ACME Bank is deploying AI to triage AML alerts[1]. Today, 12 analysts spend ~4 hours per case manually pulling KYC, sanctions, and transaction data[2]. The pilot targets a 70% time reduction while preserving audit completeness[3].

## Approach

A 6-week pilot with 4 analysts on standard-risk alerts only[4]. SAR-track cases stay human-only.

## Key risks

- **False negatives on suspicious activity** (critical) — mitigation: human review on every escalation[5]
- **PII in prompt context** (high) — mitigation: field-level redaction before model call[6]

## Success definition

By end of pilot: ≥70% of standard alerts handled via AI brief, false-negative rate within 2pp of baseline, zero PII incidents.`;

  return {
    system: SYSTEM_PROMPT,
    user: `You are generating 15 onboarding artifacts for an enterprise AI deployment.

PROJECT CONTEXT (the ONLY facts you may use — do not invent names, dates, numbers, or details):
${serializeProject(project)}

---

OUTPUT SCHEMA — return a single JSON object with exactly these 15 keys (no others), each a markdown string:

${ARTIFACT_SPECS.map((a, i) => `${i + 1}. "${a.key}" — for ${a.audience}: ${a.purpose}`).join("\n")}

---

CONSTRAINTS

1. **No invention.** Only use names, numbers, dates, and details present in the PROJECT CONTEXT above. If the context lacks a piece of information, write "to be confirmed" or omit the sentence — never fabricate.

2. **Citations.** When a sentence is derived from a specific input (workflow step, system, risk, regulatory tag, stakeholder), end it with a numbered citation in square brackets: "reduces analyst review time by 70%[1]." Use distinct numbers per artifact starting at 1. Cite where a specific input justifies the claim — don't pad. Do NOT include a "Sources" footer; the UI renders the citation list.

3. **Length.** Each artifact 150–400 words. Tighter is better — sign-off-ready, not blog post.

4. **Markdown.** Use ## section headers, - bullets, > callouts, and tables when comparing items. Make it scannable.

5. **Specificity.** Reference actual system names, workflow names, risk titles, and stakeholder roles from the context. Generic statements like "AI improves efficiency" must be replaced with concrete claims tied to the project.

---

${FEW_SHOT_EXAMPLE}

---

Return the JSON object now.`,
  };
}
