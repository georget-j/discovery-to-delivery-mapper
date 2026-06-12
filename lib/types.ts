// ────────────────────────────────────────────────────────────
// Enums / union literals
// ────────────────────────────────────────────────────────────

export type ScenarioType =
  | "fintech_aml"
  | "legaltech_contract"
  | "hardware_ops"
  | "enterprise_support"
  | "custom";

export type ProjectStatus =
  | "draft"
  | "discovery"
  | "planning"
  | "pilot"
  | "launched"
  | "stabilising";

// ────────────────────────────────────────────────────────────
// Customer Profile
// ────────────────────────────────────────────────────────────

export type Industry =
  | "fintech"
  | "legaltech"
  | "healthcare"
  | "insurance"
  | "industrial"
  | "enterprise_saas"
  | "public_sector"
  | "other";

export type CompanySize = "startup" | "mid_market" | "enterprise";
export type Urgency = "low" | "medium" | "high" | "critical";
export type TechnicalMaturity = "low" | "medium" | "high";

export type CustomerProfile = {
  companyName: string;
  industry: Industry;
  companySize: CompanySize;
  primaryUseCase: string;
  businessProblem: string;
  desiredOutcome: string;
  urgency: Urgency;
  regulatoryContext: string[];
  technicalMaturity: TechnicalMaturity;
};

// ────────────────────────────────────────────────────────────
// Discovery Input
// ────────────────────────────────────────────────────────────

export type DiscoveryInput = {
  currentProcess: string;
  usersAffected: string;
  implementationDeadline: string;
  constraints: string;
  knownRisks: string;
  successDefinition: string;
  buyerTeam: string;
  riskLevel: "low" | "medium" | "high";
};

// ────────────────────────────────────────────────────────────
// Stakeholder
// ────────────────────────────────────────────────────────────

export type StakeholderInfluence = "low" | "medium" | "high";
export type StakeholderInvolvement =
  | "sponsor"
  | "decision_maker"
  | "technical_owner"
  | "business_owner"
  | "end_user"
  | "legal_security"
  | "procurement";

export type Stakeholder = {
  id: string;
  name: string;
  role: string;
  team: string;
  influence: StakeholderInfluence;
  involvement: StakeholderInvolvement;
  concerns: string[];
  requiredActions: string[];
};

// ────────────────────────────────────────────────────────────
// Workflow Step
// ────────────────────────────────────────────────────────────

export type ManualEffort = "low" | "medium" | "high";
export type Frequency = "daily" | "weekly" | "monthly" | "ad_hoc";
export type AutomationPotential = "low" | "medium" | "high";
export type FutureState =
  | "human_led"
  | "ai_assisted"
  | "automated"
  | "requires_approval";

export type WorkflowStep = {
  id: string;
  name: string;
  description: string;
  ownerTeam: string;
  currentSystem: string;
  inputData: string[];
  outputArtifact: string[];
  painPoints: string[];
  manualEffort: ManualEffort;
  frequency: Frequency;
  failureModes: string[];
  automationPotential: AutomationPotential;
  futureState: FutureState;
};

// ────────────────────────────────────────────────────────────
// Customer System
// ────────────────────────────────────────────────────────────

export type SystemType =
  | "crm"
  | "case_management"
  | "document_management"
  | "data_warehouse"
  | "ticketing"
  | "email"
  | "chat"
  | "core_system"
  | "custom"
  | "other";

export type AccessMethod =
  | "api"
  | "database"
  | "csv_export"
  | "manual_upload"
  | "webhook"
  | "unknown";

export type DataSensitivity = "low" | "medium" | "high" | "regulated";
export type IntegrationComplexity = "low" | "medium" | "high";

export type CustomerSystem = {
  id: string;
  name: string;
  type: SystemType;
  owner: string;
  accessMethod: AccessMethod;
  apiAvailable: boolean | "unknown";
  authenticationMethod: string;
  dataSensitivity: DataSensitivity;
  integrationComplexity: IntegrationComplexity;
  notes: string;
};

// ────────────────────────────────────────────────────────────
// Data Source
// ────────────────────────────────────────────────────────────

export type DataType =
  | "documents"
  | "tickets"
  | "customer_records"
  | "transactions"
  | "contracts"
  | "messages"
  | "logs"
  | "other";

export type DataFormat =
  | "pdf"
  | "docx"
  | "csv"
  | "xlsx"
  | "json"
  | "api"
  | "database"
  | "mixed"
  | "unknown";

export type DataQuality = "poor" | "mixed" | "good" | "unknown";
export type AccessStatus = "available" | "pending" | "blocked" | "unknown";

export type DataSource = {
  id: string;
  name: string;
  sourceSystem: string;
  dataType: DataType;
  format: DataFormat;
  quality: DataQuality;
  volumeEstimate: string;
  updateFrequency: string;
  pii: boolean | "unknown";
  accessStatus: AccessStatus;
  openQuestions: string[];
};

// ────────────────────────────────────────────────────────────
// Requirement
// ────────────────────────────────────────────────────────────

export type RequirementCategory =
  | "functional"
  | "technical"
  | "data"
  | "integration"
  | "security"
  | "compliance"
  | "reporting"
  | "support"
  | "change_management";

export type RequirementPriority = "must_have" | "should_have" | "nice_to_have";

export type RequirementSource =
  | "customer_discovery"
  | "workflow_mapping"
  | "technical_scoping"
  | "security_review"
  | "generated";

export type RequirementOwner = "customer" | "startup" | "shared" | "unknown";
export type RequirementStatus = "confirmed" | "assumption" | "needs_validation";

export type Requirement = {
  id: string;
  title: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  source: RequirementSource;
  owner: RequirementOwner;
  status: RequirementStatus;
  // Evidence trail — links back to the workflow step / session / stakeholder /
  // discovery field that drove this requirement. Populated by the engine and
  // by the NotesImport flow. Optional for legacy / manually-added items.
  sourceRefs?: SourceRef[];
  // Short ("Generated because…") sentence explaining WHY this auto-derived
  // requirement appeared. Populated by the engine for auto items.
  rationale?: string;
};

// ────────────────────────────────────────────────────────────
// Missing Info Item
// ────────────────────────────────────────────────────────────

export type MissingInfoOwner =
  | "customer"
  | "product"
  | "engineering"
  | "security"
  | "commercial"
  | "unknown";

export type MissingInfoRelatedTab =
  | "discovery"
  | "workflow"
  | "systems"
  | "pilot";

export type MissingInfoItem = {
  id: string;
  item: string;
  whyItMatters: string;
  suggestedOwner: MissingInfoOwner;
  relatedTab: MissingInfoRelatedTab;
};

// ────────────────────────────────────────────────────────────
// Deployment Risk
// ────────────────────────────────────────────────────────────

export type RiskCategory =
  | "data_readiness"
  | "integration"
  | "security"
  | "stakeholder_alignment"
  | "operational_adoption"
  | "model_quality"
  | "timeline"
  | "legal_procurement"
  | "support_readiness";

export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskLikelihood = "low" | "medium" | "high";
export type RiskStatus = "open" | "mitigating" | "resolved" | "accepted";

export type DeploymentRisk = {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  owner: string;
  mitigation: string;
  escalationTrigger: string;
  status: RiskStatus;
  source?: "auto" | "manual";
  sourceRefs?: SourceRef[];
  // Short ("Generated because…") sentence explaining WHY this auto-derived
  // risk appeared. Populated by the engine for auto items.
  rationale?: string;
};

// ────────────────────────────────────────────────────────────
// Source references (evidence trail)
// ────────────────────────────────────────────────────────────

export type SourceRefType =
  | "workflow_step" // a step in project.workflows
  | "system" // a project.systems entry
  | "data_source" // a project.dataSources entry
  | "stakeholder" // a stakeholder
  | "stakeholder_concern" // a specific concern string on a stakeholder
  | "discovery_field" // a field on discovery / customer (use refId as the field name)
  | "session" // a DiscoverySession
  | "regulatory_context" // a regulatory tag
  | "knowledge_base_chunk"; // a KB chunk (Pass 4)

export type SourceRef = {
  type: SourceRefType;
  refId: string; // id of the referenced entity (or field name for discovery_field)
  label?: string; // pre-rendered label, e.g. "Workflow step #3 — Manual review"
};

// ────────────────────────────────────────────────────────────
// Action items + Discovery sessions
// ────────────────────────────────────────────────────────────

export type ActionItemUrgency = "low" | "medium" | "high";
export type ActionItemStatus = "open" | "done";

export type ActionItem = {
  id: string;
  title: string;
  assignee: string; // free-text; usually a stakeholder name
  dueDate?: string; // ISO date (YYYY-MM-DD) or quarter (Q3 2026) — free-text
  urgency: ActionItemUrgency;
  status: ActionItemStatus;
  sessionId?: string; // session this was extracted from, if any
  createdAt: string;
};

export type DiscoverySession = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  title: string; // e.g. "Initial discovery call with Sarah Chen"
  attendees: string[]; // names; loosely linked to stakeholders
  notes: string; // raw pasted notes / transcript
  extractedAt?: string; // when AI extraction was last run
  actionItems: ActionItem[]; // items extracted or added against this session
  createdAt: string;
};

// ────────────────────────────────────────────────────────────
// Pilot Plan
// ────────────────────────────────────────────────────────────

export type SuccessMetric = {
  id: string;
  name: string;
  baseline: string;
  target: string;
  measurementMethod: string;
  owner: string;
};

export type PilotPlan = {
  objective: string;
  scope: string;
  pilotUsers: string[];
  includedWorkflows: string[];
  excludedWorkflows: string[];
  durationWeeks: number;
  successMetrics: SuccessMetric[];
  launchCriteria: string[];
  rollbackCriteria: string[];
  baselineMeasurement: string;
  targetOutcome: string;
};

// ────────────────────────────────────────────────────────────
// Generated Artifacts
// ────────────────────────────────────────────────────────────

export type GeneratedArtifacts = {
  customerDiscoverySummary: string;
  currentStateWorkflow: string;
  futureStateWorkflow: string;
  requirementsMatrix: string;
  missingInformationLog: string;
  integrationAndApiPlan: string;
  dataReadinessAssessment: string;
  implementationPlan: string;
  riskRegisterSummary: string;
  pilotSuccessPlan: string;
  stakeholderCommunicationPlan: string;
  engineeringHandoff: string;
  productFeedbackMemo: string;
  executiveSummary: string;
  nextActionsChecklist: string;
  // Generation metadata — server-side stamped, used for stale detection.
  // Optional so legacy stored outputs still work.
  derivedFromHash?: string;
  generatedAt?: string;
  // Artifact keys the user has hand-edited in the Outputs tab. Regeneration
  // offers to preserve these so manual edits aren't silently overwritten.
  editedArtifacts?: string[];
  // How this pack was produced — "ai" (grounded LLM output), "template" (no
  // API key) or "template_fallback" (AI response was invalid). Written
  // client-side when a generation is persisted; absent on legacy packs.
  generationSource?: "ai" | "template" | "template_fallback";
};

// ────────────────────────────────────────────────────────────
// Root Entity
// ────────────────────────────────────────────────────────────

export type OnboardingProject = {
  id: string;
  name: string;
  customer: CustomerProfile;
  scenarioType: ScenarioType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  discovery: DiscoveryInput;
  workflows: WorkflowStep[];
  systems: CustomerSystem[];
  dataSources: DataSource[];
  requirements: Requirement[];
  risks: DeploymentRisk[];
  stakeholders: Stakeholder[];
  pilotPlan: PilotPlan | null;
  outputs: GeneratedArtifacts | null;
  // Legacy single-session notes blob. Migrated into meetingSessions[0] on first
  // open. Keep here for backwards compat with seeded scenarios and old session
  // storage payloads.
  meetingNotes?: string;
  // Multi-session discovery log — replaces the single notes textarea as the
  // primary capture surface. Each session has its own raw notes + extracted
  // action items.
  meetingSessions?: DiscoverySession[];
  visualisations?: ProjectVisualisations;
  // AI-drafted suggestions awaiting user review (Part E auto-suggest flow).
  // Cleared once the user applies or dismisses.
  pendingSuggestions?: NotesExtractionResult | null;
  // ISO timestamp of the one-shot "draft suggestions?" modal so it never
  // re-fires for the same project.
  suggestionsOfferedAt?: string;
  // Knowledge base summary — doc list lives here, chunks live in IndexedDB.
  knowledgeBase?: KnowledgeBaseSummary;
  // User-defined automation patterns for the future-state recommender.
  customPatterns?: CustomAutomationPattern[];
};

// ────────────────────────────────────────────────────────────
// Visualisations (added by the visualisation layer; see lib/visualisations/)
// ────────────────────────────────────────────────────────────

export type ProjectVisualisations = {
  currentStateWorkflowMap?: import("./visualisations/workflow-types").CurrentStateWorkflowMap;
  futureStateAIWorkflowMap?: import("./visualisations/workflow-types").FutureStateAIWorkflowMap;
  futureStateRecommendations?: FutureStateRecommendationsState;
  // architecture, lineage, heatmap, kpiTree added in later phases
};

// ────────────────────────────────────────────────────────────
// Knowledge Base (Pass 4)
// ────────────────────────────────────────────────────────────

export type KnowledgeBaseDocStatus =
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export type KnowledgeBaseDocType =
  | "pdf"
  | "docx"
  | "xlsx"
  | "csv"
  | "txt"
  | "md"
  | "json"
  | "pptx"
  | "rawtext";

export type KnowledgeBaseDoc = {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  byteSize: number;
  type: KnowledgeBaseDocType;
  addedAt: string;
  status: KnowledgeBaseDocStatus;
  statusDetail?: string;
  chunkCount: number;
  pageCount?: number;
  sheetCount?: number;
  source: "upload" | "paste";
  // Auto-generated one-paragraph summary for the doc, populated by
  // /api/summarize/doc when the user requests it. Useful in the doc
  // viewer + intake queue.
  summary?: string;
};

export type KnowledgeBaseChunk = {
  id: string;
  projectId: string;
  docId: string;
  text: string;
  page?: number;
  sheet?: string;
  rangeRef?: string;
  chunkIndex: number;
};

export type KnowledgeBaseSummary = {
  docs: KnowledgeBaseDoc[];
  totalChunks: number;
  totalTokensEmbedded: number;
  lastIngestedAt?: string;
};

// ────────────────────────────────────────────────────────────
// Future-state recommendations (Pass 4 Part B)
// ────────────────────────────────────────────────────────────

export type AutomationPatternFamily =
  | "agent"
  | "agent_with_validator"
  | "multi_agent"
  | "rag"
  | "rules_plus_ai"
  | "hitl"
  | "continuous_learning"
  | "copilot";

export type FutureStateRecommendation = {
  id: string;
  stepId: string | null; // null = workflow-level
  patternId: string;
  patternFamily: AutomationPatternFamily;
  title: string;
  rationale: string;
  confidence: number; // 0..1
  valueProposition: string;
  risks: string[];
  apply: {
    futureState: FutureState;
    futureStateDescription: string;
  };
  sourceChunkIds?: string[];
};

export type FutureStateRecommendationsState = {
  recommendations: FutureStateRecommendation[];
  generatedAt: string;
  workflowsHashAtGeneration: string;
  dismissedIds: string[];
  appliedIds: string[];
};

// Per-project user-defined automation patterns. The recommender prompt
// includes both the built-in catalogue and any custom patterns the user has
// added here, so suggestions can reference proprietary or org-specific
// playbooks.
export type CustomAutomationPattern = {
  id: string; // e.g. "custom-cx-triage"
  family: AutomationPatternFamily;
  name: string;
  shortDescription: string;
  whenToUse: string[];
  exampleArchitecture: string;
  recommendedFutureState: FutureState;
  createdAt: string;
};

// ────────────────────────────────────────────────────────────
// Notes Extraction
// ────────────────────────────────────────────────────────────

export type NotesExtractionResult = {
  discovery?: Partial<DiscoveryInput> & {
    businessProblem?: string;
    primaryUseCase?: string;
    desiredOutcome?: string;
    regulatoryContext?: string[];
  };
  suggestedStakeholders?: {
    name: string;
    role: string;
    team: string;
    concerns: string[];
  }[];
  suggestedSystems?: { name: string; type: string; notes: string }[];
  suggestedDataSources?: {
    name: string;
    dataType: string;
    format: string;
    notes: string;
  }[];
  suggestedWorkflows?: {
    name: string;
    description: string;
    ownerTeam: string;
    frequency: string;
    manualEffort: string;
    painPoints: string[];
  }[];
  suggestedRisks?: {
    title: string;
    description: string;
    category: string;
    severity: string;
    likelihood: string;
    mitigation: string;
  }[];
  suggestedActionItems?: {
    title: string;
    assignee: string;
    dueDate?: string;
    urgency: string;
  }[];
  summary: string;
};
