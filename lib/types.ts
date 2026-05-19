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

export type RequirementPriority =
  | "must_have"
  | "should_have"
  | "nice_to_have";

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

export type MissingInfoRelatedTab = "discovery" | "workflow" | "systems" | "pilot";

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
  meetingNotes?: string;
  visualisations?: ProjectVisualisations;
};

// ────────────────────────────────────────────────────────────
// Visualisations (added by the visualisation layer; see lib/visualisations/)
// ────────────────────────────────────────────────────────────

export type ProjectVisualisations = {
  currentStateWorkflowMap?: import("./visualisations/workflow-types").CurrentStateWorkflowMap;
  futureStateAIWorkflowMap?: import("./visualisations/workflow-types").FutureStateAIWorkflowMap;
  // architecture, lineage, heatmap, kpiTree added in later phases
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
  suggestedStakeholders?: { name: string; role: string; team: string; concerns: string[] }[];
  suggestedSystems?: { name: string; type: string; notes: string }[];
  suggestedDataSources?: { name: string; dataType: string; format: string; notes: string }[];
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
  summary: string;
};
