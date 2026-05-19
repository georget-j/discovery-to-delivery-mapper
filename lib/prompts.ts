import type { OnboardingProject } from "./types";

const SYSTEM_PROMPT = `You are an expert forward-deployed AI engineer and solutions architect at an early-stage AI startup.

Your role is to produce structured, professional onboarding documentation for enterprise customers deploying an AI product. You have deep knowledge of enterprise software procurement, AI deployment risk, change management, and technical integration.

Write in a clear, direct, professional tone. Avoid generic filler phrases. Be specific to the customer context provided. Use concrete examples where appropriate. Format all outputs as plain text (no markdown headers, no bullet points unless explicitly requested).`;

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
    risks: project.risks.slice(0, 8),
    pilotPlan: project.pilotPlan,
    ...(project.meetingNotes ? { meetingNotes: project.meetingNotes } : {}),
  }, null, 2);
}

export function buildArtifactPrompt(project: OnboardingProject): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `You are generating 15 onboarding artifacts for an enterprise AI deployment. Use the project context below to produce accurate, specific, high-quality content for each artifact.

PROJECT CONTEXT:
${serializeProject(project)}

Generate all 15 artifacts in the JSON response. Each artifact should be 150–400 words of professional prose appropriate for its audience. Be specific — reference actual system names, workflow names, risk titles, and stakeholder roles from the context.

CITATIONS — important. When a sentence is derived from a specific input (e.g. a workflow step, a system, a risk, a regulatory tag, a stakeholder), add a numbered citation in square brackets at the end of that sentence. Example: "reduces analyst review time by 70%[1]." Use distinct numbers per artifact starting at 1. Cite freely but only where a specific input directly justifies the claim — don't pad with citations for generic statements. Do NOT include a separate "Sources" footer; the UI renders the citation list separately.

ARTIFACTS TO GENERATE:
1. customerDiscoverySummary — Executive summary of what was learned in discovery. Audience: internal team.
2. currentStateWorkflow — Description of the customer's current manual process with pain points. Audience: engineering + product.
3. futureStateWorkflow — Vision of the AI-augmented process after deployment. Audience: customer executive.
4. requirementsMatrix — Structured list of must-have requirements derived from this engagement. Audience: engineering.
5. missingInformationLog — What information gaps remain and who owns resolving them. Audience: customer success + customer.
6. integrationAndApiPlan — Technical plan for integrating with the customer's systems. Audience: engineering.
7. dataReadinessAssessment — Assessment of data quality, access, and readiness for AI. Audience: data + engineering.
8. implementationPlan — Phased implementation plan from pilot to full rollout. Audience: customer + internal.
9. riskRegisterSummary — Summary of key deployment risks and mitigations. Audience: customer executive.
10. pilotSuccessPlan — How the pilot will be run, measured, and evaluated. Audience: customer.
11. stakeholderCommunicationPlan — How to communicate with each stakeholder group during deployment. Audience: CSM.
12. engineeringHandoff — Technical handoff document for the engineering team. Audience: engineering.
13. productFeedbackMemo — What product gaps, feature requests, or friction points this engagement revealed. Audience: product team.
14. executiveSummary — One-page summary suitable for the customer's C-suite. Audience: customer executive.
15. nextActionsChecklist — Immediate next steps for both parties in the next 2 weeks. Audience: CSM + customer.`,
  };
}
