import type { OnboardingProject } from "@/lib/types";
import { getArtifactReadiness, type ArtifactKey } from "@/lib/artifact-sources";

// Map artifact-readiness state to a pre-flight summary for the Generate Pack
// flow. Identifies thin/empty artifacts and gives the user a chance to fill
// the gaps before burning an LLM round-trip.

export type ReadinessGap = {
  key: ArtifactKey;
  label: string;
  readiness: "thin" | "empty";
  /** Suggested tab to deep-link the user to. */
  hintTab: string;
};

const ARTIFACT_LABEL_FALLBACK: Record<string, string> = {
  executiveSummary: "Executive Summary",
  customerDiscoverySummary: "Discovery Summary",
  currentStateWorkflow: "Current Workflow",
  futureStateWorkflow: "Future Workflow",
  requirementsMatrix: "Requirements Matrix",
  missingInformationLog: "Missing Information",
  integrationAndApiPlan: "Integration Plan",
  dataReadinessAssessment: "Data Readiness",
  implementationPlan: "Implementation Plan",
  riskRegisterSummary: "Risk Register",
  pilotSuccessPlan: "Pilot Plan",
  stakeholderCommunicationPlan: "Comms Plan",
  engineeringHandoff: "Engineering Handoff",
  productFeedbackMemo: "Product Feedback",
  nextActionsChecklist: "Next Actions",
};

// Where to send the user to top up the inputs that feed each artifact.
const HINT_TAB: Record<string, string> = {
  executiveSummary: "discovery",
  customerDiscoverySummary: "discovery",
  currentStateWorkflow: "workflow",
  futureStateWorkflow: "workflow",
  requirementsMatrix: "requirements",
  missingInformationLog: "requirements",
  integrationAndApiPlan: "systems",
  dataReadinessAssessment: "systems",
  implementationPlan: "pilot",
  riskRegisterSummary: "risks",
  pilotSuccessPlan: "pilot",
  stakeholderCommunicationPlan: "discovery",
  engineeringHandoff: "systems",
  productFeedbackMemo: "workflow",
  nextActionsChecklist: "",
};

const ALL_ARTIFACT_KEYS: ArtifactKey[] = [
  "executiveSummary",
  "customerDiscoverySummary",
  "currentStateWorkflow",
  "futureStateWorkflow",
  "requirementsMatrix",
  "missingInformationLog",
  "integrationAndApiPlan",
  "dataReadinessAssessment",
  "implementationPlan",
  "riskRegisterSummary",
  "pilotSuccessPlan",
  "stakeholderCommunicationPlan",
  "engineeringHandoff",
  "productFeedbackMemo",
  "nextActionsChecklist",
];

export function assessGenerationReadiness(project: OnboardingProject): {
  gaps: ReadinessGap[];
  totalCount: number;
  ok: boolean;
} {
  const gaps: ReadinessGap[] = [];
  for (const key of ALL_ARTIFACT_KEYS) {
    const readiness = getArtifactReadiness(project, key);
    if (readiness === "thin" || readiness === "empty") {
      gaps.push({
        key,
        label: ARTIFACT_LABEL_FALLBACK[key] ?? key,
        readiness,
        hintTab: HINT_TAB[key] ?? "",
      });
    }
  }
  return {
    gaps,
    totalCount: ALL_ARTIFACT_KEYS.length,
    ok: gaps.length <= 3,
  };
}
