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
  SourceRef,
} from "@/lib/types";

// Optional citation map: keys are chunk ids, values are the chunk labels
// (e.g. "sales-deck.pdf · p.3"). When provided, applied entities get a
// sourceRefs entry stamped with type="knowledge_base_chunk" for every
// chunk in the supplied list. Until per-row citation arrives from the
// generation endpoint, we apply the same global citation set to all
// newly-merged entities for a single apply call.
export type KbCitationMap = Record<string, string>;

function citationRefs(citations?: KbCitationMap): SourceRef[] {
  if (!citations) return [];
  return Object.entries(citations).map(([refId, label]) => ({
    type: "knowledge_base_chunk" as const,
    refId,
    label: clampText(label, SHORT_TEXT_MAX),
  }));
}

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

// Caps for AI/document-derived free text merged into persistent project
// state. Single-line fields (names, roles, titles, teams) are capped at
// SHORT_TEXT_MAX and lose newlines; long fields (descriptions, notes,
// mitigations, concerns, pain points) are capped at LONG_TEXT_MAX and keep
// newlines. ASCII control characters are stripped in both cases. Incoming
// suggestion arrays are capped at MAX_ITEMS_PER_APPLY rows per category.
const SHORT_TEXT_MAX = 200;
const LONG_TEXT_MAX = 2000;
const MAX_ITEMS_PER_APPLY = 20;

function clampText(s: string, max: number): string {
  const stripControls =
    max >= LONG_TEXT_MAX
      ? /[\x00-\x09\x0B-\x1F\x7F]/g // keep \n in long fields
      : /[\x00-\x1F\x7F]/g;
  return s.slice(0, max).replace(stripControls, "");
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
  citations?: KbCitationMap,
): ApplyResult {
  const kbRefs = citationRefs(citations);
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
        customerPatch[key] =
          typeof value === "string" ? clampText(value, LONG_TEXT_MAX) : value;
        applied.push(`Customer · ${key}`);
      } else if (key === "regulatoryContext" && Array.isArray(value)) {
        const tags = (value as string[])
          .slice(0, MAX_ITEMS_PER_APPLY)
          .map((tag) => clampText(tag, SHORT_TEXT_MAX));
        customerPatch.regulatoryContext = Array.from(
          new Set([...(project.customer.regulatoryContext ?? []), ...tags]),
        );
        applied.push(
          `${tags.length} regulatory tag${tags.length !== 1 ? "s" : ""}`,
        );
      } else {
        discoveryPatch[key] =
          typeof value === "string"
            ? clampText(
                value,
                key === "buyerTeam" ? SHORT_TEXT_MAX : LONG_TEXT_MAX,
              )
            : value;
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
    .slice(0, MAX_ITEMS_PER_APPLY)
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
      name: clampText(s.name ?? "", SHORT_TEXT_MAX),
      role: clampText(s.role ?? "", SHORT_TEXT_MAX),
      team: clampText(
        s.team ?? project.discovery.buyerTeam ?? "",
        SHORT_TEXT_MAX,
      ),
      influence: "medium",
      involvement: "end_user",
      concerns: (s.concerns ?? [])
        .slice(0, MAX_ITEMS_PER_APPLY)
        .map((c) => clampText(c, LONG_TEXT_MAX)),
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
    .slice(0, MAX_ITEMS_PER_APPLY)
    .map((w, idx) => ({ w, idx }))
    .filter(
      ({ w, idx }) =>
        isPicked(`workflow:${idx}` as SuggestionRowId) &&
        !existingWfNames.has(w.name.toLowerCase()),
    )
    .map(({ w }) => ({
      id: generateId(),
      name: clampText(w.name, SHORT_TEXT_MAX),
      description: clampText(w.description ?? "", LONG_TEXT_MAX),
      ownerTeam: clampText(
        w.ownerTeam ?? project.discovery.buyerTeam ?? "",
        SHORT_TEXT_MAX,
      ),
      currentSystem: "",
      inputData: [],
      outputArtifact: [],
      painPoints: (w.painPoints ?? [])
        .slice(0, MAX_ITEMS_PER_APPLY)
        .map((p) => clampText(p, LONG_TEXT_MAX)),
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
    .slice(0, MAX_ITEMS_PER_APPLY)
    .map((s, idx) => ({ s, idx }))
    .filter(
      ({ s, idx }) =>
        isPicked(`system:${idx}` as SuggestionRowId) &&
        !existingSysNames.has(s.name.toLowerCase()),
    )
    .map(({ s }) => ({
      id: generateId(),
      name: clampText(s.name, SHORT_TEXT_MAX),
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
      notes: clampText(s.notes ?? "", LONG_TEXT_MAX),
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
    .slice(0, MAX_ITEMS_PER_APPLY)
    .map((d, idx) => ({ d, idx }))
    .filter(
      ({ d, idx }) =>
        isPicked(`dataSource:${idx}` as SuggestionRowId) &&
        !existingSrcNames.has(d.name.toLowerCase()),
    )
    .map(({ d }) => ({
      id: generateId(),
      name: clampText(d.name, SHORT_TEXT_MAX),
      sourceSystem: "",
      dataType: pick<DataType>(d.dataType, DATA_TYPES, "other"),
      format: pick<DataFormat>(d.format, DATA_FORMATS, "unknown"),
      quality: "unknown",
      volumeEstimate: "",
      updateFrequency: "",
      pii: "unknown",
      accessStatus: "unknown",
      openQuestions: d.notes ? [clampText(d.notes, LONG_TEXT_MAX)] : [],
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
    .slice(0, MAX_ITEMS_PER_APPLY)
    .map((rk, idx) => ({ rk, idx }))
    .filter(
      ({ rk, idx }) =>
        isPicked(`risk:${idx}` as SuggestionRowId) &&
        !existingRiskTitles.has(rk.title.toLowerCase()),
    )
    .map(({ rk }) => ({
      id: generateId(),
      title: clampText(rk.title, SHORT_TEXT_MAX),
      description: clampText(rk.description ?? "", LONG_TEXT_MAX),
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
      mitigation: clampText(rk.mitigation ?? "", LONG_TEXT_MAX),
      escalationTrigger: "",
      status: "open",
      source: "manual",
      sourceRefs: kbRefs,
    }));
  if (newRisks.length > 0) {
    patch.risks = [...project.risks, ...newRisks];
    applied.push(`${newRisks.length} risk${newRisks.length !== 1 ? "s" : ""}`);
  }

  return { patch, appliedLabels: applied };
}
