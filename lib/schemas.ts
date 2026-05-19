import { z } from "zod";

export const GeneratedArtifactsSchema = z.object({
  customerDiscoverySummary: z.string(),
  currentStateWorkflow: z.string(),
  futureStateWorkflow: z.string(),
  requirementsMatrix: z.string(),
  missingInformationLog: z.string(),
  integrationAndApiPlan: z.string(),
  dataReadinessAssessment: z.string(),
  implementationPlan: z.string(),
  riskRegisterSummary: z.string(),
  pilotSuccessPlan: z.string(),
  stakeholderCommunicationPlan: z.string(),
  engineeringHandoff: z.string(),
  productFeedbackMemo: z.string(),
  executiveSummary: z.string(),
  nextActionsChecklist: z.string(),
});

export type GeneratedArtifactsSchema = z.infer<typeof GeneratedArtifactsSchema>;

const StakeholderSuggestionSchema = z.object({
  name: z.string(),
  role: z.string(),
  team: z.string(),
  concerns: z.array(z.string()),
});

const SystemSuggestionSchema = z.object({
  name: z.string(),
  type: z.string(),
  notes: z.string(),
});

const DataSourceSuggestionSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  format: z.string(),
  notes: z.string(),
});

const WorkflowSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  ownerTeam: z.string(),
  frequency: z.string(),
  manualEffort: z.string(),
  painPoints: z.array(z.string()),
});

const RiskSuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  severity: z.string(),
  likelihood: z.string(),
  mitigation: z.string(),
});

const DiscoverySuggestionSchema = z.object({
  businessProblem: z.string().optional(),
  primaryUseCase: z.string().optional(),
  desiredOutcome: z.string().optional(),
  currentProcess: z.string().optional(),
  successDefinition: z.string().optional(),
  implementationDeadline: z.string().optional(),
  buyerTeam: z.string().optional(),
  constraints: z.string().optional(),
  regulatoryContext: z.array(z.string()).optional(),
}).optional();

export const NotesExtractionResultSchema = z.object({
  discovery: DiscoverySuggestionSchema,
  suggestedStakeholders: z.array(StakeholderSuggestionSchema).optional(),
  suggestedSystems: z.array(SystemSuggestionSchema).optional(),
  suggestedDataSources: z.array(DataSourceSuggestionSchema).optional(),
  suggestedWorkflows: z.array(WorkflowSuggestionSchema).optional(),
  suggestedRisks: z.array(RiskSuggestionSchema).optional(),
  summary: z.string(),
});

export type NotesExtractionResultSchema = z.infer<typeof NotesExtractionResultSchema>;
