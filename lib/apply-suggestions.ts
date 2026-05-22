// Hoisted helper: turn a NotesExtractionResult + a Set of picked row IDs
// into a Partial<OnboardingProject> patch. Reused by both the per-session
// notes-extraction flow (SessionEditor) and the Generate-from-Discovery
// flow (GenerateFromDiscoveryButton), so the merge semantics live in one
// place.

import { generateId } from "@/lib/utils";
import type {
  NotesExtractionResult,
  OnboardingProject,
  CustomerSystem,
  DataSource,
  DeploymentRisk,
  Stakeholder,
  WorkflowStep,
  SystemType,
  DataType,
  DataFormat,
  ManualEffort,
  Frequency,
  RiskCategory,
  RiskSeverity,
  RiskLikelihood,
} from "@/lib/types";

// Suggestion row keys — same shape as NotesDiffPanel's `RowId`.
export type SuggestionRowId =
  | `discovery:${string}`
  | `stakeholder:${number}`
  | `system:${number}`
  | `dataSource:${number}`
  | `workflow:${number}`
  | `risk:${number}`;

// Enum sanitisers — clamp any AI-supplied string to a known literal.
const SYSTEM_TYPES: SystemType[] = [
  "crm",
  "case_management",
  "document_management",
  "data_warehouse",
  "ticketing",
  "email",
  "chat",
  "core_system",
  "custom",
  "other",
];
const DATA_TYPES: DataType[] = [
  "documents",
  "tickets",
  "customer_records",
  "transactions",
  "contracts",
  "messages",
  "logs",
  "other",
];
const DATA_FORMATS: DataFormat[] = [
  "pdf",
  "docx",
  "csv",
  "xlsx",
  "json",
  "api",
  "database",
  "mixed",
  "unknown",
];
const MANUAL_EFFORTS: ManualEffort[] = ["low", "medium", "high"];
const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "ad_hoc"];
const RISK_CATEGORIES: RiskCategory[] = [
  "data_readiness",
  "integration",
  "security",
  "stakeholder_alignment",
  "operational_adoption",
  "model_quality",
  "timeline",
  "legal_procurement",
  "support_readiness",
];
const RISK_SEVERITIES: RiskSeverity[] = ["critical", "high", "medium", "low"];
const RISK_LIKELIHOODS: RiskLikelihood[] = ["high", "medium", "low"];

function pick<T extends string>(
  candidate: string | undefined,
  valid: readonly T[],
  fallback: T,
): T {
  return valid.includes(candidate as T) ? (candidate as T) : fallback;
}

export type ApplyResult = {
  patch: Partial<OnboardingProject>;
  appliedLabels: string[];
};

// Build a patch that merges every picked suggestion into the project. Dedups
// by lowercased name/title against existing rows so re-running suggestions
// doesn't duplicate prior ones.
export function applySuggestionsToProject(
  project: OnboardingProject,
  suggestions: NotesExtractionResult,
  selected: Set<SuggestionRowId>,
): ApplyResult {
  const isPicked = (id: SuggestionRowId) => selected.has(id);
  const patch: Partial<OnboardingProject> = {};
  const applied: string[] = [];

  // ── Discovery + customer profile ────────────────────────────────────────
  if (suggestions.discovery) {
    const customerPatch: Record<string, unknown> = {};
    const discoveryPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(suggestions.discovery)) {
      if (!isPicked(`discovery:${key}` as SuggestionRowId)) continue;
      if (Array.isArray(value) ? value.length === 0 : !value) continue;
      if (
        key === "businessProblem" ||
        key === "primaryUseCase" ||
        key === "desiredOutcome"
      ) {
        customerPatch[key] = value;
        applied.push(`Customer · ${key}`);
      } else if (key === "regulatoryContext" && Array.isArray(value)) {
        customerPatch.regulatoryContext = Array.from(
          new Set([
            ...(project.customer.regulatoryContext ?? []),
            ...(value as string[]),
          ]),
        );
        applied.push(
          `${value.length} regulatory tag${value.length !== 1 ? "s" : ""}`,
        );
      } else {
        discoveryPatch[key] = value;
        applied.push(`Discovery · ${key}`);
      }
    }
    if (Object.keys(customerPatch).length > 0)
      patch.customer = { ...project.customer, ...customerPatch };
    if (Object.keys(discoveryPatch).length > 0)
      patch.discovery = { ...project.discovery, ...discoveryPatch };
  }

  // ── Stakeholders ────────────────────────────────────────────────────────
  const existingStakeholderNames = new Set(
    project.stakeholders.map((s) => s.name.toLowerCase()),
  );
  const existingStakeholderRoles = new Set(
    project.stakeholders.map((s) => s.role.toLowerCase()),
  );
  const newStakeholders: Stakeholder[] = (
    suggestions.suggestedStakeholders ?? []
  )
    .map((s, idx) => ({ s, idx }))
    .filter(({ s, idx }) => {
      if (!isPicked(`stakeholder:${idx}` as SuggestionRowId)) return false;
      // Dedup by name when present, otherwise by role — the from-Discovery
      // flow leaves name="" so it would otherwise collapse everything to
      // one row.
      if (s.name) return !existingStakeholderNames.has(s.name.toLowerCase());
      if (s.role) return !existingStakeholderRoles.has(s.role.toLowerCase());
      return true;
    })
    .map(({ s }) => ({
      id: generateId(),
      name: s.name ?? "",
      role: s.role ?? "",
      team: s.team ?? project.discovery.buyerTeam ?? "",
      influence: "medium",
      involvement: "end_user",
      concerns: s.concerns ?? [],
      requiredActions: [],
    }));
  if (newStakeholders.length > 0) {
    patch.stakeholders = [...project.stakeholders, ...newStakeholders];
    applied.push(
      `${newStakeholders.length} stakeholder${newStakeholders.length !== 1 ? "s" : ""}`,
    );
  }

  // ── Workflows ────────────────────────────────────────────────────────────
  const existingWfNames = new Set(
    project.workflows.map((w) => w.name.toLowerCase()),
  );
  const newWorkflows: WorkflowStep[] = (suggestions.suggestedWorkflows ?? [])
    .map((w, idx) => ({ w, idx }))
    .filter(
      ({ w, idx }) =>
        isPicked(`workflow:${idx}` as SuggestionRowId) &&
        !existingWfNames.has(w.name.toLowerCase()),
    )
    .map(({ w }) => ({
      id: generateId(),
      name: w.name,
      description: w.description ?? "",
      ownerTeam: w.ownerTeam ?? project.discovery.buyerTeam ?? "",
      currentSystem: "",
      inputData: [],
      outputArtifact: [],
      painPoints: w.painPoints ?? [],
      manualEffort: pick<ManualEffort>(
        w.manualEffort,
        MANUAL_EFFORTS,
        "medium",
      ),
      frequency: pick<Frequency>(w.frequency, FREQUENCIES, "ad_hoc"),
      failureModes: [],
      automationPotential: "medium",
      futureState: "ai_assisted",
    }));
  if (newWorkflows.length > 0) {
    patch.workflows = [...project.workflows, ...newWorkflows];
    applied.push(
      `${newWorkflows.length} workflow step${newWorkflows.length !== 1 ? "s" : ""}`,
    );
  }

  // ── Systems ──────────────────────────────────────────────────────────────
  const existingSysNames = new Set(
    project.systems.map((s) => s.name.toLowerCase()),
  );
  const newSystems: CustomerSystem[] = (suggestions.suggestedSystems ?? [])
    .map((s, idx) => ({ s, idx }))
    .filter(
      ({ s, idx }) =>
        isPicked(`system:${idx}` as SuggestionRowId) &&
        !existingSysNames.has(s.name.toLowerCase()),
    )
    .map(({ s }) => ({
      id: generateId(),
      name: s.name,
      type: pick<SystemType>(s.type, SYSTEM_TYPES, "other"),
      owner: project.discovery.buyerTeam ?? "",
      accessMethod: "unknown",
      apiAvailable: "unknown",
      authenticationMethod: "",
      dataSensitivity:
        (project.customer.regulatoryContext?.length ?? 0) > 0
          ? "regulated"
          : "medium",
      integrationComplexity: "medium",
      notes: s.notes ?? "",
    }));
  if (newSystems.length > 0) {
    patch.systems = [...project.systems, ...newSystems];
    applied.push(
      `${newSystems.length} system${newSystems.length !== 1 ? "s" : ""}`,
    );
  }

  // ── Data sources ─────────────────────────────────────────────────────────
  const existingSrcNames = new Set(
    project.dataSources.map((d) => d.name.toLowerCase()),
  );
  const newSources: DataSource[] = (suggestions.suggestedDataSources ?? [])
    .map((d, idx) => ({ d, idx }))
    .filter(
      ({ d, idx }) =>
        isPicked(`dataSource:${idx}` as SuggestionRowId) &&
        !existingSrcNames.has(d.name.toLowerCase()),
    )
    .map(({ d }) => ({
      id: generateId(),
      name: d.name,
      sourceSystem: "",
      dataType: pick<DataType>(d.dataType, DATA_TYPES, "other"),
      format: pick<DataFormat>(d.format, DATA_FORMATS, "unknown"),
      quality: "unknown",
      volumeEstimate: "",
      updateFrequency: "",
      pii: "unknown",
      accessStatus: "unknown",
      openQuestions: d.notes ? [d.notes] : [],
    }));
  if (newSources.length > 0) {
    patch.dataSources = [...project.dataSources, ...newSources];
    applied.push(
      `${newSources.length} data source${newSources.length !== 1 ? "s" : ""}`,
    );
  }

  // ── Risks ────────────────────────────────────────────────────────────────
  const existingRiskTitles = new Set(
    project.risks.map((r) => r.title.toLowerCase()),
  );
  const newRisks: DeploymentRisk[] = (suggestions.suggestedRisks ?? [])
    .map((rk, idx) => ({ rk, idx }))
    .filter(
      ({ rk, idx }) =>
        isPicked(`risk:${idx}` as SuggestionRowId) &&
        !existingRiskTitles.has(rk.title.toLowerCase()),
    )
    .map(({ rk }) => ({
      id: generateId(),
      title: rk.title,
      description: rk.description ?? "",
      category: pick<RiskCategory>(
        rk.category,
        RISK_CATEGORIES,
        "operational_adoption",
      ),
      severity: pick<RiskSeverity>(rk.severity, RISK_SEVERITIES, "medium"),
      likelihood: pick<RiskLikelihood>(
        rk.likelihood,
        RISK_LIKELIHOODS,
        "medium",
      ),
      owner: "",
      mitigation: rk.mitigation ?? "",
      escalationTrigger: "",
      status: "open",
      source: "manual",
      sourceRefs: [],
    }));
  if (newRisks.length > 0) {
    patch.risks = [...project.risks, ...newRisks];
    applied.push(`${newRisks.length} risk${newRisks.length !== 1 ? "s" : ""}`);
  }

  return { patch, appliedLabels: applied };
}
