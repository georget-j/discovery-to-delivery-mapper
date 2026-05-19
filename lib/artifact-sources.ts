// For every artifact, return the structured SourceRef list that explains
// which project inputs fed it. Mirrors the rules baked into the deterministic
// template builders (lib/artifact-templates.ts) so the sources panel, inline
// citations, and coverage matrix all agree on what's used where.

import type {
  OnboardingProject,
  GeneratedArtifacts,
  SourceRef,
  Stakeholder,
  WorkflowStep,
  CustomerSystem,
  DataSource,
  DeploymentRisk,
} from "./types";

// Narrowed to the 15 string-valued artifact keys only; excludes metadata
// fields like derivedFromHash and generatedAt that share the GeneratedArtifacts
// type but aren't artifacts.
export type ArtifactKey =
  | "executiveSummary" | "customerDiscoverySummary"
  | "currentStateWorkflow" | "futureStateWorkflow"
  | "requirementsMatrix" | "missingInformationLog"
  | "integrationAndApiPlan" | "dataReadinessAssessment"
  | "implementationPlan" | "riskRegisterSummary"
  | "pilotSuccessPlan" | "stakeholderCommunicationPlan"
  | "engineeringHandoff" | "productFeedbackMemo" | "nextActionsChecklist";

// One titled group of refs — used by the sources panel and inline footnotes.
export type SourceSection = {
  label: string;
  refs: SourceRef[];
};

export type ArtifactSourceMap = {
  artifactKey: ArtifactKey;
  sections: SourceSection[];   // grouped for the panel + footnote legend
  inputs: SourceRef[];          // flat list (for the matrix + counts)
};

// ── Helpers that turn project entities into SourceRefs ─────────────────────

const workflowRef = (w: WorkflowStep, suffix?: string): SourceRef => ({
  type: "workflow_step", refId: w.id, label: w.name + (suffix ? ` ${suffix}` : ""),
});
const systemRef = (s: CustomerSystem): SourceRef => ({
  type: "system", refId: s.id, label: s.name,
});
const dataSourceRef = (d: DataSource): SourceRef => ({
  type: "data_source", refId: d.id, label: d.name,
});
const stakeholderRef = (s: Stakeholder): SourceRef => ({
  type: "stakeholder", refId: s.id, label: `${s.name} — ${s.role}`,
});
const riskRef = (r: DeploymentRisk): SourceRef => ({
  type: "stakeholder_concern", refId: r.id, label: `${r.title} (${r.severity})`,
});
const discoveryFieldRef = (field: string, label: string): SourceRef => ({
  type: "discovery_field", refId: field, label,
});
const regulatoryRef = (reg: string): SourceRef => ({
  type: "regulatory_context", refId: reg, label: reg,
});

// Filter helpers matching the template rules
const highAutoSteps = (p: OnboardingProject) => p.workflows.filter((w) => w.automationPotential === "high");
const blockedSystems = (p: OnboardingProject) => p.systems.filter((s) => s.apiAvailable === false);
const piiSources = (p: OnboardingProject) => p.dataSources.filter((d) => d.pii === true);
const poorSources = (p: OnboardingProject) => p.dataSources.filter((d) => d.quality === "poor" || d.quality === "mixed");
const blockedSources = (p: OnboardingProject) => p.dataSources.filter((d) => d.accessStatus === "blocked" || d.accessStatus === "unknown");
const topRisks = (p: OnboardingProject) =>
  [...p.risks]
    .filter((r) => r.severity === "critical" || r.severity === "high")
    .slice(0, 3);

const customerSection = (p: OnboardingProject, fields: ("companyName" | "industry" | "companySize" | "businessProblem" | "primaryUseCase" | "desiredOutcome" | "urgency" | "technicalMaturity")[]): SourceSection => {
  const refs: SourceRef[] = [];
  const labels: Record<string, string> = {
    companyName: `Company: ${p.customer.companyName || "—"}`,
    industry: `Industry: ${p.customer.industry || "—"}`,
    companySize: `Size: ${p.customer.companySize || "—"}`,
    businessProblem: "Business problem",
    primaryUseCase: "Primary use case",
    desiredOutcome: "Desired outcome",
    urgency: `Urgency: ${p.customer.urgency || "—"}`,
    technicalMaturity: `Technical maturity: ${p.customer.technicalMaturity || "—"}`,
  };
  for (const f of fields) {
    if (p.customer[f]) refs.push(discoveryFieldRef(`customer.${f}`, labels[f]));
  }
  return { label: "Customer profile", refs };
};

const regulatorySection = (p: OnboardingProject): SourceSection => ({
  label: "Regulatory context",
  refs: (p.customer.regulatoryContext ?? []).map(regulatoryRef),
});

const discoverySection = (p: OnboardingProject, fields: ("currentProcess" | "successDefinition" | "implementationDeadline" | "constraints" | "knownRisks" | "buyerTeam" | "usersAffected" | "riskLevel")[]): SourceSection => {
  const labels: Record<string, string> = {
    currentProcess: "Current process",
    successDefinition: "Success definition",
    implementationDeadline: "Implementation deadline",
    constraints: "Constraints",
    knownRisks: "Known risks",
    buyerTeam: "Sponsoring team",
    usersAffected: "Affected user population",
    riskLevel: `Risk level: ${p.discovery.riskLevel}`,
  };
  const refs: SourceRef[] = [];
  for (const f of fields) {
    const v = p.discovery[f];
    if (v) refs.push(discoveryFieldRef(`discovery.${f}`, labels[f]));
  }
  return { label: "Discovery call", refs };
};

// Drops a section if it has zero refs — keeps the panel clean.
function trim(sections: SourceSection[]): SourceSection[] {
  return sections.filter((s) => s.refs.length > 0);
}

function flatten(sections: SourceSection[]): SourceRef[] {
  return sections.flatMap((s) => s.refs);
}

// ── Per-artifact source maps ───────────────────────────────────────────────

export function computeArtifactSources(project: OnboardingProject, artifactKey: ArtifactKey): ArtifactSourceMap {
  const build = (sections: SourceSection[]): ArtifactSourceMap => {
    const trimmed = trim(sections);
    return { artifactKey, sections: trimmed, inputs: flatten(trimmed) };
  };

  switch (artifactKey) {
    case "executiveSummary":
      return build([
        customerSection(project, ["companyName", "industry", "companySize", "businessProblem", "primaryUseCase", "desiredOutcome"]),
        regulatorySection(project),
        { label: "High-automation workflows", refs: highAutoSteps(project).map((w) => workflowRef(w, "(high auto)")) },
        { label: "Top risks", refs: topRisks(project).map(riskRef) },
        {
          label: "Pilot plan",
          refs: project.pilotPlan?.objective
            ? [discoveryFieldRef("pilotPlan.objective", `Pilot: ${project.pilotPlan.durationWeeks}w, ${project.pilotPlan.pilotUsers.length} users`)]
            : [],
        },
        discoverySection(project, ["successDefinition"]),
      ]);

    case "customerDiscoverySummary":
      return build([
        customerSection(project, ["companyName", "industry", "companySize", "technicalMaturity", "urgency", "businessProblem", "primaryUseCase", "desiredOutcome"]),
        regulatorySection(project),
        discoverySection(project, ["buyerTeam", "implementationDeadline", "usersAffected", "riskLevel", "successDefinition", "currentProcess", "constraints", "knownRisks"]),
        { label: "High-automation workflows", refs: highAutoSteps(project).map((w) => workflowRef(w, "(high auto)")) },
      ]);

    case "currentStateWorkflow":
      return build([
        discoverySection(project, ["currentProcess"]),
        { label: "All workflow steps", refs: project.workflows.map((w) => workflowRef(w)) },
        { label: "Systems in use", refs: project.systems.map(systemRef) },
      ]);

    case "futureStateWorkflow":
      return build([
        customerSection(project, ["primaryUseCase", "desiredOutcome"]),
        { label: "Workflow steps + future state", refs: project.workflows.map((w) => workflowRef(w, `→ ${w.futureState.replace(/_/g, " ")}`)) },
        discoverySection(project, ["successDefinition"]),
      ]);

    case "requirementsMatrix":
      return build([
        { label: "Systems without APIs", refs: blockedSystems(project).map(systemRef) },
        regulatorySection(project),
        { label: "PII data sources", refs: piiSources(project).map(dataSourceRef) },
      ]);

    case "missingInformationLog":
      return build([
        discoverySection(project, ["currentProcess", "successDefinition"]),
        { label: "Stakeholders mapped", refs: project.stakeholders.map(stakeholderRef) },
        { label: "Systems without APIs", refs: blockedSystems(project).map(systemRef) },
        { label: "Data sources with access issues", refs: blockedSources(project).map(dataSourceRef) },
        regulatorySection(project),
      ]);

    case "integrationAndApiPlan":
      return build([
        { label: "All systems", refs: project.systems.map(systemRef) },
        { label: "All data sources", refs: project.dataSources.map(dataSourceRef) },
      ]);

    case "dataReadinessAssessment":
      return build([
        { label: "All data sources", refs: project.dataSources.map(dataSourceRef) },
        { label: "Poor / mixed quality", refs: poorSources(project).map(dataSourceRef) },
        { label: "Access issues", refs: blockedSources(project).map(dataSourceRef) },
      ]);

    case "implementationPlan":
      return build([
        { label: "Systems to integrate", refs: project.systems.map(systemRef) },
        discoverySection(project, ["implementationDeadline"]),
        regulatorySection(project),
        {
          label: "Pilot plan",
          refs: project.pilotPlan?.objective
            ? [discoveryFieldRef("pilotPlan", `${project.pilotPlan.durationWeeks}-week pilot, ${project.pilotPlan.pilotUsers.length} users`)]
            : [],
        },
      ]);

    case "riskRegisterSummary":
      return build([
        { label: "All risks", refs: project.risks.map(riskRef) },
        discoverySection(project, ["riskLevel"]),
      ]);

    case "pilotSuccessPlan":
      return build([
        {
          label: "Pilot plan",
          refs: project.pilotPlan?.objective
            ? [
                discoveryFieldRef("pilotPlan.objective", `Objective: ${project.pilotPlan.objective.slice(0, 60)}${project.pilotPlan.objective.length > 60 ? "…" : ""}`),
                discoveryFieldRef("pilotPlan.scope", `Scope: ${project.pilotPlan.scope ? project.pilotPlan.scope.slice(0, 60) : "—"}`),
                discoveryFieldRef("pilotPlan.duration", `Duration: ${project.pilotPlan.durationWeeks} weeks`),
                discoveryFieldRef("pilotPlan.users", `${project.pilotPlan.pilotUsers.length} pilot users`),
                discoveryFieldRef("pilotPlan.metrics", `${project.pilotPlan.successMetrics.length} success metrics`),
                discoveryFieldRef("pilotPlan.criteria", `${project.pilotPlan.launchCriteria.length} launch + ${project.pilotPlan.rollbackCriteria.length} rollback criteria`),
              ]
            : [],
        },
        { label: "Workflows in scope", refs: project.workflows.map((w) => workflowRef(w)) },
      ]);

    case "stakeholderCommunicationPlan":
      return build([
        { label: "All stakeholders", refs: project.stakeholders.map(stakeholderRef) },
      ]);

    case "engineeringHandoff":
      return build([
        { label: "All systems", refs: project.systems.map(systemRef) },
        { label: "All data sources", refs: project.dataSources.map(dataSourceRef) },
        { label: "Integration blockers (no API)", refs: blockedSystems(project).map(systemRef) },
        { label: "Data access blockers", refs: blockedSources(project).map(dataSourceRef) },
        regulatorySection(project),
        { label: "PII data sources", refs: piiSources(project).map(dataSourceRef) },
      ]);

    case "productFeedbackMemo":
      return build([
        customerSection(project, ["industry", "companySize", "urgency"]),
        regulatorySection(project),
        { label: "Systems without APIs", refs: blockedSystems(project).map(systemRef) },
        { label: "Poor / mixed quality data", refs: poorSources(project).map(dataSourceRef) },
      ]);

    case "nextActionsChecklist":
      return build([
        discoverySection(project, ["currentProcess", "successDefinition", "implementationDeadline"]),
        { label: "Stakeholders mapped", refs: project.stakeholders.map(stakeholderRef) },
        { label: "Data access blockers", refs: blockedSources(project).map(dataSourceRef) },
        { label: "Systems without APIs", refs: blockedSystems(project).map(systemRef) },
        regulatorySection(project),
      ]);
  }
}

// ── Coverage matrix helpers ────────────────────────────────────────────────

export type CoverageInputCategory =
  | "customer" | "discovery" | "regulatory" | "workflows" | "systems"
  | "data_sources" | "stakeholders" | "risks" | "pilot";

export const ARTIFACT_KEYS_ORDERED: ArtifactKey[] = [
  "executiveSummary", "customerDiscoverySummary",
  "currentStateWorkflow", "futureStateWorkflow",
  "requirementsMatrix", "missingInformationLog",
  "integrationAndApiPlan", "dataReadinessAssessment",
  "implementationPlan", "riskRegisterSummary",
  "pilotSuccessPlan", "stakeholderCommunicationPlan",
  "engineeringHandoff", "productFeedbackMemo", "nextActionsChecklist",
];

export const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  executiveSummary: "Executive Summary",
  customerDiscoverySummary: "Discovery Summary",
  currentStateWorkflow: "Current State",
  futureStateWorkflow: "Future State",
  requirementsMatrix: "Requirements",
  missingInformationLog: "Missing Info",
  integrationAndApiPlan: "Integration Plan",
  dataReadinessAssessment: "Data Readiness",
  implementationPlan: "Impl. Plan",
  riskRegisterSummary: "Risk Summary",
  pilotSuccessPlan: "Pilot Plan",
  stakeholderCommunicationPlan: "Comms Plan",
  engineeringHandoff: "Eng Handoff",
  productFeedbackMemo: "Product Memo",
  nextActionsChecklist: "Next Actions",
};

const REF_TO_CATEGORY: Record<SourceRef["type"], CoverageInputCategory> = {
  workflow_step: "workflows",
  system: "systems",
  data_source: "data_sources",
  stakeholder: "stakeholders",
  stakeholder_concern: "risks",       // we use stakeholder_concern for risks in the map
  discovery_field: "discovery",
  session: "discovery",
  regulatory_context: "regulatory",
};

// Coverage cell: does this input category feed this artifact?
export type CoverageStrength = "solid" | "hollow" | "none";

export function coverageCell(
  project: OnboardingProject,
  artifact: ArtifactKey,
  category: CoverageInputCategory,
): { strength: CoverageStrength; count: number } {
  const map = computeArtifactSources(project, artifact);
  let refs = map.inputs.filter((r) => REF_TO_CATEGORY[r.type] === category);

  // Special-case categories that don't map to a single SourceRef type
  if (category === "customer") {
    refs = map.inputs.filter((r) => r.type === "discovery_field" && r.refId.startsWith("customer."));
  } else if (category === "discovery") {
    refs = map.inputs.filter((r) => r.type === "discovery_field" && (r.refId.startsWith("discovery.") || r.refId.startsWith("pilotPlan")));
  } else if (category === "pilot") {
    refs = map.inputs.filter((r) => r.type === "discovery_field" && r.refId.startsWith("pilotPlan"));
  }
  // Subtract pilot from discovery so they don't double-count
  if (category === "discovery") {
    refs = refs.filter((r) => !r.refId.startsWith("pilotPlan"));
  }

  if (refs.length === 0) return { strength: "none", count: 0 };
  // Hollow when only some entities of a populated category are referenced (e.g. only HIGH automation workflows)
  const totalEntities = (() => {
    switch (category) {
      case "workflows": return project.workflows.length;
      case "systems": return project.systems.length;
      case "data_sources": return project.dataSources.length;
      case "stakeholders": return project.stakeholders.length;
      case "risks": return project.risks.length;
      default: return refs.length;
    }
  })();
  if (totalEntities > 0 && refs.length < totalEntities) return { strength: "hollow", count: refs.length };
  return { strength: "solid", count: refs.length };
}
