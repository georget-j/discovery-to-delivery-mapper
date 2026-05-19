import type { OnboardingProject, DeploymentRisk, RiskCategory, RiskSeverity, RiskLikelihood } from "./types";
import { generateId } from "./utils";

function risk(
  title: string,
  description: string,
  category: RiskCategory,
  severity: RiskSeverity,
  likelihood: RiskLikelihood,
  mitigation: string,
  overrides?: Partial<DeploymentRisk>
): DeploymentRisk {
  return {
    id: generateId(),
    title,
    description,
    category,
    severity,
    likelihood,
    owner: "shared",
    mitigation,
    escalationTrigger: "",
    status: "open",
    ...overrides,
  };
}

export function generateRisks(project: OnboardingProject): DeploymentRisk[] {
  const results: DeploymentRisk[] = [];

  // ── Integration risks: systems with no API ────────────────────────────────
  for (const system of project.systems) {
    if (system.apiAvailable === false) {
      results.push(risk(
        `No API available: ${system.name}`,
        `${system.name} has no available API, requiring a custom integration. This increases engineering effort, timeline risk, and ongoing maintenance burden.`,
        "integration",
        "high",
        "high",
        "Scope a custom connector or file-based pipeline. Add 4–6 weeks buffer to integration timeline.",
        { owner: "engineering", escalationTrigger: "Integration timeline exceeds 6 weeks or vendor refuses to provide data access", sourceRefs: [{ type: "system", refId: system.id, label: system.name }] }
      ));
    }
    if (system.integrationComplexity === "high") {
      results.push(risk(
        `High integration complexity: ${system.name}`,
        `${system.name} is rated high complexity. Integration may require significant custom work, authentication challenges, or schema mapping.`,
        "integration",
        "medium",
        "medium",
        "Conduct a dedicated technical scoping session with the customer's IT team before committing to a timeline.",
        { owner: "engineering", sourceRefs: [{ type: "system", refId: system.id, label: system.name }] }
      ));
    }
  }

  // ── Data readiness risks ───────────────────────────────────────────────────
  for (const source of project.dataSources) {
    if (source.quality === "poor") {
      results.push(risk(
        `Poor data quality: ${source.name}`,
        `${source.name} data quality is rated poor. This will degrade model accuracy and may require expensive remediation before training or inference can begin.`,
        "data_readiness",
        "high",
        "high",
        "Allocate dedicated data quality sprint before pilot. Define minimum quality thresholds as a launch criterion.",
        { owner: "customer", escalationTrigger: "Data quality below agreed threshold at T-4 weeks before pilot start", sourceRefs: [{ type: "data_source", refId: source.id, label: source.name }] }
      ));
    }
    if (source.accessStatus === "blocked") {
      results.push(risk(
        `Blocked data access: ${source.name}`,
        `Access to ${source.name} is currently blocked. Without this data, the AI product cannot operate as designed.`,
        "data_readiness",
        "critical",
        "high",
        "Escalate to customer executive sponsor immediately. Define a hard unblock deadline as a launch criterion.",
        { owner: "customer", escalationTrigger: "Access not unblocked within 2 weeks of project start", sourceRefs: [{ type: "data_source", refId: source.id, label: source.name }] }
      ));
    }
  }

  // ── Security risks: regulated data ────────────────────────────────────────
  const hasRegulatedData = project.systems.some((s) => s.dataSensitivity === "regulated") ||
    project.dataSources.some((d) => d.pii === true);

  if (hasRegulatedData) {
    results.push(risk(
      "Regulated/PII data security controls",
      "The deployment involves regulated or PII data. Inadequate controls could result in a data breach, regulatory fine, or reputational damage.",
      "security",
      "high",
      "medium",
      "Complete security review and data processing agreement before any data is transferred. Implement encryption at rest and in transit.",
      { owner: "security", escalationTrigger: "DPA not signed 4 weeks before pilot start or security review fails" }
    ));
  }

  // ── Stakeholder alignment risks ────────────────────────────────────────────
  const hasTechOwner = project.stakeholders.some((s) => s.involvement === "technical_owner");
  if (!hasTechOwner) {
    results.push(risk(
      "No technical owner identified",
      "Without a named technical owner, integration work, environment setup, and security approvals will stall waiting for unclear accountability.",
      "stakeholder_alignment",
      "high",
      "high",
      "Require a named technical owner as a pre-condition of project kick-off. Escalate to executive sponsor if not provided.",
      { owner: "customer", escalationTrigger: "Technical owner not named within 1 week of project start" }
    ));
  }

  if (project.stakeholders.length === 0) {
    results.push(risk(
      "No stakeholders mapped",
      "Without stakeholder mapping, change management, approval workflows, and escalation paths cannot be planned.",
      "stakeholder_alignment",
      "medium",
      "high",
      "Run a stakeholder mapping session in week 1 of the engagement. Identify sponsor, technical owner, and end-user champion.",
      { owner: "customer" }
    ));
  }

  // ── Operational adoption risks ─────────────────────────────────────────────
  if (project.customer.technicalMaturity === "low") {
    results.push(risk(
      "Low technical maturity — adoption risk",
      "Customer technical maturity is low. End-user adoption may be slow, requiring more training, change management, and ongoing support than typical deployments.",
      "operational_adoption",
      "medium",
      "high",
      "Invest in structured onboarding training, runbooks, and a dedicated CSM touchpoint for the first 90 days post-launch.",
      { owner: "startup" }
    ));
  }

  // ── Timeline risks ─────────────────────────────────────────────────────────
  if (project.customer.urgency === "critical" && !project.discovery.currentProcess) {
    results.push(risk(
      "Incomplete discovery with critical urgency",
      "The customer has marked urgency as critical but discovery is incomplete. Rushing to delivery without complete discovery frequently results in scope creep and re-work.",
      "timeline",
      "high",
      "high",
      "Hold a mandatory discovery completion session before any delivery work begins. Communicate the risk of starting without full discovery.",
      { owner: "shared", escalationTrigger: "Discovery not completed within 2 weeks of project start" }
    ));
  }

  if (project.customer.urgency === "critical" || project.customer.urgency === "high") {
    const hasBlockedData = project.dataSources.some((d) => d.accessStatus === "blocked");
    const hasMissingApi = project.systems.some((s) => s.apiAvailable === false);
    if (hasBlockedData || hasMissingApi) {
      results.push(risk(
        "Aggressive timeline with unresolved blockers",
        "High urgency combined with blocked data access or missing APIs creates a risk of timeline slippage. Dependencies outside the team's control cannot be accelerated by effort alone.",
        "timeline",
        "high",
        "high",
        "Surface blockers to executive sponsor immediately. Negotiate a realistic go-live date that accounts for resolution time.",
        { owner: "shared", escalationTrigger: "Blockers not resolved by T-3 weeks before agreed pilot start" }
      ));
    }
  }

  // ── Legal/procurement risks ────────────────────────────────────────────────
  if (project.customer.regulatoryContext.length > 0) {
    results.push(risk(
      "Regulatory compliance — procurement and legal review",
      `Customer is subject to ${project.customer.regulatoryContext.join(", ")}. Legal and procurement sign-off may be required before deployment and could introduce delays.`,
      "legal_procurement",
      "medium",
      "medium",
      "Engage customer legal and procurement teams in week 1. Provide compliance documentation pack early to avoid last-minute delays.",
      { owner: "customer", escalationTrigger: "Legal/procurement review not started within 2 weeks of project kick-off" }
    ));
  }

  // ── Fintech-specific risks ────────────────────────────────────────────────
  if (project.customer.industry === "fintech") {
    results.push(risk(
      "Model explainability — regulatory requirement",
      "Financial regulators (FCA, FATF, MiFID II) increasingly require explainable AI. If model outputs cannot be explained in plain language, the deployment may be blocked post-launch.",
      "legal_procurement",
      "high",
      "medium",
      "Architect explainability into the model from day one. Document decision logic and confidence thresholds. Involve compliance team in model review.",
      { owner: "startup", escalationTrigger: "Model fails explainability test in pilot review" }
    ));
    results.push(risk(
      "Incomplete audit trail for AI decisions",
      "Financial compliance requires a full audit trail for every AI-assisted decision. Missing logs could expose the customer to regulatory sanction.",
      "security",
      "high",
      "medium",
      "Implement immutable audit logging from day one of the pilot. Include: input, output, model version, timestamp, and user action taken.",
      { owner: "startup" }
    ));
  }

  // ── Legaltech-specific risks ──────────────────────────────────────────────
  if (project.customer.industry === "legaltech") {
    results.push(risk(
      "AI hallucination in legal content",
      "LLM-generated legal content risks factual errors (hallucinations) that could constitute professional negligence if relied upon without review.",
      "model_quality",
      "critical",
      "medium",
      "Implement mandatory human review for all AI-generated legal content. Add citation grounding and confidence scoring. Do not allow autonomous publication.",
      { owner: "startup", escalationTrigger: "Hallucination rate exceeds 2% in pilot testing" }
    ));
    results.push(risk(
      "Attorney-client privilege breach",
      "Feeding privileged client communications into a third-party AI system could constitute a privilege waiver, creating legal liability for the law firm.",
      "legal_procurement",
      "critical",
      "low",
      "Require legal opinion on privilege implications before any client data is processed. Implement strict data segregation and consent controls.",
      { owner: "shared", escalationTrigger: "Any privileged data is inadvertently included in training or inference without consent" }
    ));
  }

  // ── Support readiness ─────────────────────────────────────────────────────
  if (!project.pilotPlan || project.pilotPlan.successMetrics.length === 0) {
    results.push(risk(
      "No success metrics defined — pilot sign-off risk",
      "Without agreed success metrics, the pilot cannot be objectively evaluated and sign-off decisions will be contested.",
      "support_readiness",
      "medium",
      "high",
      "Define quantitative success metrics with the customer before pilot start. Include baseline, target, and measurement method for each.",
      { owner: "shared" }
    ));
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });
}
