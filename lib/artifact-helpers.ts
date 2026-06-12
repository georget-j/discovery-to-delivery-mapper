import type { OnboardingProject } from "./types";

// A lightweight hash of every project field that any of the 15 artifact builders
// or AI prompts read. Used to detect when generated outputs are stale relative
// to the inputs that produced them. Mirrors `hashWorkflows` in
// lib/visualisations/workflow-helpers.ts.
//
// Format is deliberately readable rather than cryptographic — we want diffs
// to localise to a single section if something changes.
export function hashGenerationInputs(project: OnboardingProject): string {
  const parts: string[] = [
    // Customer profile
    `c|${project.customer.companyName}|${project.customer.industry}|${project.customer.companySize}|${project.customer.urgency}|${project.customer.technicalMaturity}`,
    `c2|${project.customer.businessProblem}|${project.customer.primaryUseCase}|${project.customer.desiredOutcome}`,
    `c3|${(project.customer.regulatoryContext ?? []).join(",")}`,

    // Discovery
    `d|${project.discovery.currentProcess}|${project.discovery.successDefinition}|${project.discovery.implementationDeadline}`,
    `d2|${project.discovery.buyerTeam}|${project.discovery.usersAffected}|${project.discovery.riskLevel}`,
    `d3|${project.discovery.constraints}|${project.discovery.knownRisks}`,

    // Workflows — name + futureState + currentSystem drive most artifacts
    `w|${project.workflows.map((w) => `${w.name}/${w.futureState}/${w.currentSystem}/${w.automationPotential}`).join(";")}`,

    // Systems
    `s|${project.systems.map((s) => `${s.name}/${s.type}/${s.apiAvailable}/${s.dataSensitivity}`).join(";")}`,

    // Data sources
    `ds|${project.dataSources.map((d) => `${d.name}/${d.quality}/${d.accessStatus}/${d.pii}`).join(";")}`,

    // Stakeholders
    `st|${project.stakeholders.map((s) => `${s.name}/${s.involvement}/${s.influence}`).join(";")}`,

    // Risks
    `r|${project.risks.map((r) => `${r.title}/${r.severity}/${r.status}`).join(";")}`,

    // Pilot plan
    `p|${project.pilotPlan?.objective ?? ""}/${project.pilotPlan?.durationWeeks ?? ""}/${project.pilotPlan?.pilotUsers.length ?? 0}/${project.pilotPlan?.successMetrics.length ?? 0}`,
  ];
  return parts.join("::");
}

// Citation markers like "reduces review time by 70%[3]" reference the in-app
// sources panel; exported/copied documents have no such panel, so a customer
// receives bare [3] markers pointing at nothing. Strip them on the way out
// (markdown links like [text](url) are left intact).
export function stripCitationMarkers(markdown: string): string {
  return markdown.replace(/\[\d+\](?!\()/g, "");
}
