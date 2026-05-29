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
  derivedFromHash: z.string().optional(),
  generatedAt: z.string().optional(),
  editedArtifacts: z.array(z.string()).optional(),
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

const ActionItemSuggestionSchema = z.object({
  title: z.string(),
  assignee: z.string(),
  dueDate: z.string().optional(),
  urgency: z.string(),
});

const DiscoverySuggestionSchema = z
  .object({
    businessProblem: z.string().optional(),
    primaryUseCase: z.string().optional(),
    desiredOutcome: z.string().optional(),
    currentProcess: z.string().optional(),
    successDefinition: z.string().optional(),
    implementationDeadline: z.string().optional(),
    buyerTeam: z.string().optional(),
    constraints: z.string().optional(),
    regulatoryContext: z.array(z.string()).optional(),
  })
  .optional();

export const NotesExtractionResultSchema = z.object({
  discovery: DiscoverySuggestionSchema,
  suggestedStakeholders: z.array(StakeholderSuggestionSchema).optional(),
  suggestedSystems: z.array(SystemSuggestionSchema).optional(),
  suggestedDataSources: z.array(DataSourceSuggestionSchema).optional(),
  suggestedWorkflows: z.array(WorkflowSuggestionSchema).optional(),
  suggestedRisks: z.array(RiskSuggestionSchema).optional(),
  suggestedActionItems: z.array(ActionItemSuggestionSchema).optional(),
  summary: z.string(),
});

export type NotesExtractionResultSchema = z.infer<
  typeof NotesExtractionResultSchema
>;

// ────────────────────────────────────────────────────────────
// Knowledge Base + Recommendations (Pass 4)
// ────────────────────────────────────────────────────────────

export const EmbedRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(32000)).min(1).max(100),
});
export type EmbedRequest = z.infer<typeof EmbedRequestSchema>;

export const FromKbContextChunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  label: z.string().optional(),
});

export const FromKbRequestSchema = z.object({
  projectId: z.string(),
  target: z.enum([
    "discovery",
    "workflows",
    "systems",
    "stakeholders",
    "risks",
    "all",
  ]),
  contextChunks: z.array(FromKbContextChunkSchema).max(40),
});

const RecommendationApplySchema = z.object({
  futureState: z.enum([
    "human_led",
    "ai_assisted",
    "automated",
    "requires_approval",
  ]),
  futureStateDescription: z.string(),
});

const RecommendationItemSchema = z.object({
  id: z.string(),
  stepId: z.string().nullable(),
  patternId: z.string(),
  patternFamily: z.enum([
    "agent",
    "agent_with_validator",
    "multi_agent",
    "rag",
    "rules_plus_ai",
    "hitl",
    "continuous_learning",
    "copilot",
  ]),
  title: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  valueProposition: z.string(),
  risks: z.array(z.string()),
  apply: RecommendationApplySchema,
  sourceChunkIds: z.array(z.string()).optional(),
});

export const RecommendationsResponseSchema = z.object({
  recommendations: z.array(RecommendationItemSchema),
});
export type RecommendationsResponse = z.infer<
  typeof RecommendationsResponseSchema
>;

// ────────────────────────────────────────────────────────────
// Map-aware AI moves + workflow review (Pass 7)
// ────────────────────────────────────────────────────────────

const PatternFamilySchema = z.enum([
  "agent",
  "agent_with_validator",
  "multi_agent",
  "rag",
  "rules_plus_ai",
  "hitl",
  "continuous_learning",
  "copilot",
]);

const FutureNodeTypeSchema = z.enum([
  "human_action",
  "ai_assist",
  "ai_agent",
  "system_action",
  "data_retrieval",
  "guardrail",
  "decision_gate",
  "approval",
  "monitoring",
  "audit_log",
  "exception_path",
]);

const MapMoveSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string().nullable(),
  patternFamily: PatternFamilySchema,
  title: z.string(),
  rationale: z.string(),
  insert: z.object({
    nodes: z
      .array(
        z.object({
          key: z.string(),
          type: FutureNodeTypeSchema,
          laneId: z.string(),
          title: z.string(),
          description: z.string().optional(),
        }),
      )
      .min(1)
      .max(6),
    internalEdges: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string().optional(),
        }),
      )
      .optional(),
    connectFromSource: z.boolean().optional(),
    connectFromSourceLabel: z.string().optional(),
    connectToExisting: z
      .array(
        z.object({
          fromKey: z.string(),
          toNodeId: z.string(),
          label: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const MapMovesResponseSchema = z.object({
  moves: z.array(MapMoveSchema).max(8),
  stageQuestions: z.record(z.array(z.string())).optional(),
});
export type MapMovesResponse = z.infer<typeof MapMovesResponseSchema>;

const ReviewFindingSchema = z.object({
  kind: z.enum(["duplicate", "misplaced", "redundant"]),
  nodeIds: z.array(z.string()).min(1),
  reason: z.string(),
  suggestedAction: z.enum(["merge", "remove", "keep"]),
});

export const WorkflowReviewResponseSchema = z.object({
  findings: z.array(ReviewFindingSchema).max(20),
});
export type WorkflowReviewResponse = z.infer<
  typeof WorkflowReviewResponseSchema
>;
