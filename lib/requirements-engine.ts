import type {
  OnboardingProject,
  Requirement,
  RequirementCategory,
  RequirementPriority,
} from "./types";
import { generateId } from "./utils";

function req(
  title: string,
  description: string,
  category: RequirementCategory,
  priority: RequirementPriority,
  overrides?: Partial<Requirement>,
): Requirement {
  return {
    id: generateId(),
    title,
    description,
    category,
    priority,
    source: "generated",
    owner: "shared",
    status: "assumption",
    ...overrides,
  };
}

export function generateRequirements(
  project: OnboardingProject,
): Requirement[] {
  const results: Requirement[] = [];

  // ── Functional: high-automation-potential workflow steps ──────────────────
  for (const step of project.workflows) {
    if (step.automationPotential === "high") {
      results.push(
        req(
          `Automate: ${step.name}`,
          `Workflow step "${step.name}" (owner: ${step.ownerTeam || "unknown"}) has high automation potential and should be a primary AI use case in scope.`,
          "functional",
          "must_have",
          {
            sourceRefs: [
              { type: "workflow_step", refId: step.id, label: step.name },
            ],
            rationale: `Workflow step "${step.name}" is tagged automation potential = high.`,
          },
        ),
      );
    }
  }

  // ── Integration: systems with no API ─────────────────────────────────────
  for (const system of project.systems) {
    if (system.apiAvailable === false) {
      results.push(
        req(
          `Custom integration: ${system.name}`,
          `${system.name} has no available API. A custom connector, CSV-based pipeline, or manual upload workflow must be scoped before go-live.`,
          "integration",
          "must_have",
          {
            source: "technical_scoping",
            sourceRefs: [
              { type: "system", refId: system.id, label: system.name },
            ],
            rationale: `${system.name} is flagged as having no API in the Systems tab.`,
          },
        ),
      );
    }
    if (system.accessMethod === "unknown") {
      results.push(
        req(
          `Clarify access method: ${system.name}`,
          `Access method for ${system.name} is unknown. Must be resolved during technical scoping before integration design can begin.`,
          "integration",
          "must_have",
          {
            source: "technical_scoping",
            status: "needs_validation",
            sourceRefs: [
              { type: "system", refId: system.id, label: system.name },
            ],
            rationale: `${system.name} has access method = unknown in the Systems tab.`,
          },
        ),
      );
    }
  }

  // ── Data: poor-quality data sources ──────────────────────────────────────
  for (const source of project.dataSources) {
    if (source.quality === "poor") {
      results.push(
        req(
          `Data remediation: ${source.name}`,
          `${source.name} is rated poor quality. A data cleansing, labelling, or enrichment programme is required before model training or inference can proceed.`,
          "data",
          "must_have",
          {
            source: "workflow_mapping",
            sourceRefs: [
              { type: "data_source", refId: source.id, label: source.name },
            ],
            rationale: `${source.name} has data quality = poor in the Systems tab.`,
          },
        ),
      );
    }
    if (source.quality === "mixed") {
      results.push(
        req(
          `Data quality review: ${source.name}`,
          `${source.name} is rated mixed quality. A data quality assessment should be completed and documented before go-live.`,
          "data",
          "should_have",
          {
            source: "workflow_mapping",
            sourceRefs: [
              { type: "data_source", refId: source.id, label: source.name },
            ],
            rationale: `${source.name} has data quality = mixed in the Systems tab.`,
          },
        ),
      );
    }

    // ── Security: PII data sources ─────────────────────────────────────────
    if (source.pii === true) {
      results.push(
        req(
          `PII handling policy: ${source.name}`,
          `${source.name} contains PII. Data retention, masking, access controls, and deletion procedures must be documented and approved before processing begins.`,
          "security",
          "must_have",
          {
            source: "security_review",
            owner: "shared",
            status: "needs_validation",
            sourceRefs: [
              { type: "data_source", refId: source.id, label: source.name },
            ],
            rationale: `${source.name} is flagged as containing PII.`,
          },
        ),
      );
    }
  }

  // ── Compliance: regulatory context ───────────────────────────────────────
  if (project.customer.regulatoryContext.length > 0) {
    const regs = project.customer.regulatoryContext.join(", ");
    results.push(
      req(
        "Regulatory compliance documentation",
        `Customer operates under ${regs}. All AI model outputs, data processing activities, and audit trails must comply with applicable obligations before deployment.`,
        "compliance",
        "must_have",
        {
          source: "customer_discovery",
          owner: "shared",
          status: "needs_validation",
          sourceRefs: project.customer.regulatoryContext.map((r) => ({
            type: "regulatory_context" as const,
            refId: r,
            label: r,
          })),
        },
      ),
    );
  }

  // ── Security: regulated data sensitivity ─────────────────────────────────
  const hasRegulatedSystem = project.systems.some(
    (s) => s.dataSensitivity === "regulated",
  );
  if (hasRegulatedSystem) {
    results.push(
      req(
        "Regulated data security controls",
        "One or more systems handle regulated data. Encryption at rest and in transit, access logging, and DLP controls must be in place before go-live.",
        "security",
        "must_have",
        {
          source: "security_review",
          owner: "startup",
          status: "needs_validation",
        },
      ),
    );
    results.push(
      req(
        "Data processing agreement (DPA)",
        "Regulated data requires a signed DPA between the customer and the AI vendor before any data is transferred or processed.",
        "compliance",
        "must_have",
        {
          source: "security_review",
          owner: "shared",
          status: "needs_validation",
        },
      ),
    );
  }

  // ── Technical: low maturity customers need extra enablement ──────────────
  if (project.customer.technicalMaturity === "low") {
    results.push(
      req(
        "Technical enablement and onboarding training",
        "Customer technical maturity is low. Structured onboarding sessions, runbooks, and an escalation path are required to achieve self-sufficiency.",
        "change_management",
        "must_have",
        { source: "customer_discovery", owner: "startup" },
      ),
    );
  }

  // ── Support: all projects ─────────────────────────────────────────────────
  results.push(
    req(
      "Dedicated support channel during pilot",
      "Customer must have a dedicated escalation path (Slack channel, named CSM) during the pilot period to accelerate issue resolution.",
      "support",
      "should_have",
      { source: "customer_discovery", owner: "startup" },
    ),
  );

  // ── Reporting ─────────────────────────────────────────────────────────────
  results.push(
    req(
      "Pilot performance dashboard",
      "Weekly reporting on model accuracy, throughput, error rates, and user adoption must be available throughout the pilot.",
      "reporting",
      "should_have",
      { source: "customer_discovery", owner: "startup" },
    ),
  );

  // ── Fintech-specific ─────────────────────────────────────────────────────
  if (project.customer.industry === "fintech") {
    results.push(
      req(
        "Model explainability for regulatory review",
        "All AI decisions must be explainable in plain language for regulator requests. Confidence scores and top contributing factors must be logged with each decision.",
        "compliance",
        "must_have",
        {
          source: "customer_discovery",
          owner: "startup",
          status: "needs_validation",
        },
      ),
    );
    results.push(
      req(
        "Audit trail for all AI-assisted decisions",
        "Every AI recommendation or action must produce an immutable audit record including input, output, model version, and approving user (if required).",
        "functional",
        "must_have",
        { source: "customer_discovery", owner: "startup" },
      ),
    );
  }

  // ── Legaltech-specific ───────────────────────────────────────────────────
  if (project.customer.industry === "legaltech") {
    results.push(
      req(
        "Hallucination detection and citation grounding",
        "All AI-generated legal content must cite source documents. A hallucination detection layer or human review gate is required before outputs reach clients.",
        "functional",
        "must_have",
        {
          source: "customer_discovery",
          owner: "startup",
          status: "needs_validation",
        },
      ),
    );
    results.push(
      req(
        "Attorney-client privilege preservation",
        "Data handling must preserve attorney-client privilege. No privileged communications may be used for model training without explicit consent.",
        "compliance",
        "must_have",
        {
          source: "customer_discovery",
          owner: "shared",
          status: "needs_validation",
        },
      ),
    );
  }

  // Deduplicate by title (in case seeded requirements overlap generated ones)
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });
}
