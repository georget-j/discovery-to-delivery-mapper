import type { OnboardingProject, GeneratedArtifacts } from "./types";

function humanise(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function callout(section: string): string {
  return `> ⚠ **${section}** — awaiting input`;
}

function orCallout(value: string | undefined | null, section: string): string {
  return value && value.trim() ? value : callout(section);
}

export function generateTemplateArtifacts(
  project: OnboardingProject,
): GeneratedArtifacts {
  const {
    customer,
    discovery,
    workflows,
    systems,
    dataSources,
    stakeholders,
    risks,
    pilotPlan,
  } = project;
  const name = customer.companyName;
  const industry = humanise(customer.industry);
  const companySize = humanise(customer.companySize);
  const highAutoSteps = workflows
    .filter((w) => w.automationPotential === "high")
    .map((w) => w.name);
  const blockedSystems = systems
    .filter((s) => s.apiAvailable === false)
    .map((s) => s.name);
  const criticalRisks = risks
    .filter((r) => r.severity === "critical" || r.severity === "high")
    .slice(0, 3);
  const regs =
    customer.regulatoryContext.length > 0
      ? customer.regulatoryContext.join(", ")
      : null;

  return {
    executiveSummary: `# Executive Summary — ${name}

## Opportunity

${name} is a **${companySize} ${industry}** company seeking to deploy AI to address: **${customer.businessProblem || "a key operational challenge (not yet documented)"}**.

The primary use case is **${customer.primaryUseCase || "to be defined"}**. Desired outcome: ${customer.desiredOutcome || callout("Desired outcome")}.

${highAutoSteps.length > 0 ? `**${highAutoSteps.length} workflow step${highAutoSteps.length !== 1 ? "s" : ""}** identified as high automation potential: ${highAutoSteps.slice(0, 3).join(", ")}.` : ""}
${regs ? `\nSubject to **${regs}** — compliance documentation required before data transfer.` : ""}

## Approach

Delivery in four phases: **integration** (${systems.length || 0} systems in scope) → **${pilotPlan ? `${pilotPlan.durationWeeks}-week` : "8-week"} pilot** with ${pilotPlan?.pilotUsers.length ? `${pilotPlan.pilotUsers.length} named users` : "selected pilot users"} → **pilot review** → **full rollout**.

## Key Risks

${criticalRisks.length > 0 ? criticalRisks.map((r) => `- **${r.title}** (${humanise(r.severity)}) — ${r.mitigation || "mitigation to be defined"}`).join("\n") : "Risks are within normal range for this type of deployment. Full risk register attached."}

## Success Definition

${discovery.successDefinition ? `> "${discovery.successDefinition}"` : callout("Success definition — must be agreed before pilot launch")}

## Recommended Next Steps

1. ${blockedSystems.length > 0 ? `Resolve API access for **${blockedSystems.join(", ")}**` : "Confirm integration approach for all in-scope systems"}
2. ${!discovery.successDefinition ? "Define measurable pilot success criteria with the customer" : "Finalise pilot plan and share with customer for sign-off"}
3. ${customer.regulatoryContext.length > 0 ? "Begin DPA review with customer legal/procurement" : "Schedule integration scoping session with customer technical owner"}
4. Confirm pilot user names and training schedule
5. Commence integration work on agreed start date

We are confident this deployment can deliver measurable value within **${pilotPlan ? pilotPlan.durationWeeks : 8} weeks** of pilot launch.`,

    customerDiscoverySummary: `# Customer Discovery Summary — ${name}

## Company Profile

| Field | Detail |
|---|---|
| **Company** | ${name} |
| **Industry** | ${industry} |
| **Size** | ${companySize} |
| **Technical Maturity** | ${humanise(customer.technicalMaturity)} |
| **Urgency** | ${humanise(customer.urgency)} |
${regs ? `| **Regulatory Context** | ${regs} |` : ""}

## Business Problem

${orCallout(customer.businessProblem, "Business problem")}

**Primary use case:** ${customer.primaryUseCase || callout("Primary use case")}

**Desired outcome:** ${customer.desiredOutcome || callout("Desired outcome")}

## Discovery Session

- **Buyer team:** ${discovery.buyerTeam || callout("Buyer team")}
- **Implementation deadline:** ${discovery.implementationDeadline || "Not yet set"}
- **Users affected:** ${discovery.usersAffected ? String(discovery.usersAffected) : "Not specified"}
- **Risk level:** ${humanise(discovery.riskLevel)}
- **Success definition:** ${discovery.successDefinition || callout("Success definition")}

## Current Process

${orCallout(discovery.currentProcess, "Current process description")}

## Constraints

${orCallout(discovery.constraints, "Constraints")}

## Automation Potential

${highAutoSteps.length > 0 ? `Highest automation potential identified in: **${highAutoSteps.join(", ")}**.` : callout("Automation potential — workflow mapping incomplete; revisit after the Workflow tab is populated")}`,

    currentStateWorkflow: `# Current State Workflow — ${name}

${orCallout(discovery.currentProcess, "Current process description")}

${
  workflows.length > 0
    ? `## Workflow Steps (${workflows.length} documented)

${workflows
  .map(
    (w, i) => `### ${i + 1}. ${w.name}

- **Owner:** ${w.ownerTeam || "Unknown"}
- **Frequency:** ${humanise(w.frequency)}
- **Manual effort:** ${humanise(w.manualEffort)}
- **Current system:** ${w.currentSystem || "Not specified"}
${w.description ? `- **Description:** ${w.description}` : ""}
${w.painPoints.filter(Boolean).length > 0 ? `- **Pain points:** ${w.painPoints.join("; ")}` : ""}
${w.failureModes.filter(Boolean).length > 0 ? `- **Failure modes:** ${w.failureModes.join("; ")}` : ""}`,
  )
  .join("\n\n")}`
    : callout(
        "Workflow mapping — no steps documented yet. Populate the Workflow tab to complete this section",
      )
}

## Systems in Use

${systems.length > 0 ? systems.map((s) => `- **${s.name}** (${humanise(s.type)})`).join("\n") : callout("Systems — no systems mapped yet")}`,

    futureStateWorkflow: `# Future State Workflow — ${name}

Following successful AI deployment, ${name}'s **${customer.primaryUseCase || "target workflow"}** will shift from a predominantly manual process to an AI-augmented or automated flow.

## Step-by-Step Future State

${
  workflows.length > 0
    ? workflows
        .map(
          (w) => `**${w.name}**
- Current: ${humanise(w.manualEffort)} manual effort
- Future: **${humanise(w.futureState)}**${w.automationPotential === "high" ? " — high automation potential" : ""}`,
        )
        .join("\n\n")
    : callout(
        "Future state — populate the Workflow tab with steps and future state designations",
      )
}

## Expected Outcomes

${customer.desiredOutcome ? `- ${customer.desiredOutcome}` : callout("Desired outcome — not yet captured in discovery")}

## Success Definition

${discovery.successDefinition ? `> "${discovery.successDefinition}"` : callout("Success definition — must be agreed before pilot launch")}`,

    requirementsMatrix: `# Requirements Matrix — ${name}

## Must Have

${blockedSystems.length > 0 ? blockedSystems.map((s) => `- [ ] Custom integration or workaround for **${s}** (no API available)`).join("\n") : "- [x] API integrations confirmed for all in-scope systems"}
${customer.regulatoryContext.length > 0 ? `- [ ] Regulatory compliance documentation covering: **${regs}**` : ""}
${dataSources.some((d) => d.pii === true) ? "- [ ] PII data handling policy and data processing agreement\n- [ ] Encryption at rest and in transit for all PII data" : ""}
- [ ] Audit trail for all AI-assisted decisions
- [ ] Model accuracy above agreed threshold before go-live
- [ ] Rollback mechanism tested and documented

## Should Have

- [ ] Dedicated support channel during pilot (e.g. Slack)
- [ ] Weekly performance reporting dashboard during pilot
- [ ] End-user training programme before pilot launch
- [ ] Integration health monitoring and alerting

## Nice to Have

- [ ] Real-time anomaly alerting
- [ ] Self-service model retraining interface
- [ ] Automated reporting to customer BI tools`,

    missingInformationLog: `# Missing Information Log — ${name}

Items below must be resolved before pilot launch.

${
  [
    ...blockedSystems.map(
      (s) =>
        `- **[Engineering]** API access or integration method for **${s}** — blocks integration design`,
    ),
    ...(!discovery.currentProcess
      ? [
          "- **[Customer]** Full current process documentation — required for workflow mapping and baseline measurement",
        ]
      : []),
    ...(!discovery.successDefinition
      ? [
          "- **[Customer]** Measurable success definition — required for pilot sign-off criteria",
        ]
      : []),
    ...(stakeholders.length === 0
      ? [
          "- **[Customer]** Named stakeholders including technical owner and executive sponsor",
        ]
      : []),
    ...dataSources
      .filter(
        (d) => d.accessStatus === "blocked" || d.accessStatus === "unknown",
      )
      .map(
        (d) =>
          `- **[Customer]** Data access resolution for **${d.name}** (status: ${humanise(d.accessStatus)})`,
      ),
    ...(customer.regulatoryContext.length > 0
      ? [
          "- **[Commercial]** Data processing agreement — required before any data is transferred",
        ]
      : []),
  ].join("\n") || "No open items identified at this stage."
}

---

**Open items:** ${[!discovery.currentProcess, !discovery.successDefinition, stakeholders.length === 0, blockedSystems.length > 0].filter(Boolean).length + dataSources.filter((d) => d.accessStatus !== "available").length} · All must be resolved before pilot start.`,

    integrationAndApiPlan: `# Integration & API Plan — ${name}

## Systems in Scope

${
  systems.length > 0
    ? `| System | Type | API | Access Method | Complexity | Sensitivity |
|---|---|---|---|---|---|
${systems.map((s) => `| ${s.name} | ${humanise(s.type)} | ${s.apiAvailable ? "Yes" : "No"} | ${humanise(s.accessMethod)} | ${humanise(s.integrationComplexity)} | ${humanise(s.dataSensitivity)} |`).join("\n")}`
    : callout("Systems — no systems mapped. Populate the Systems tab")
}

## Integration Approach

${
  systems.filter((s) => s.apiAvailable === true).length > 0
    ? `**API integrations (${systems.filter((s) => s.apiAvailable === true).length} systems):**

${systems
  .filter((s) => s.apiAvailable === true)
  .map(
    (s) =>
      `- **${s.name}**: REST API. Auth: ${s.authenticationMethod || "TBD"}. Sensitivity: ${humanise(s.dataSensitivity)}.`,
  )
  .join("\n")}`
    : ""
}

${
  systems.filter((s) => s.apiAvailable === false).length > 0
    ? `**Custom integrations required (${systems.filter((s) => s.apiAvailable === false).length} systems):**

${systems
  .filter((s) => s.apiAvailable === false)
  .map(
    (s) =>
      `- **${s.name}**: No API. Options: CSV export pipeline, webhook workaround, or manual upload — scope to be agreed.`,
  )
  .join("\n")}`
    : ""
}

## Data Pipeline

${
  dataSources.length > 0
    ? `| Source | Type | Format | Quality | Access | PII |
|---|---|---|---|---|---|
${dataSources.map((d) => `| ${d.name} | ${humanise(d.dataType)} | ${humanise(d.format)} | ${humanise(d.quality)} | ${humanise(d.accessStatus)} | ${d.pii ? "Yes" : "No"} |`).join("\n")}`
    : callout("Data sources — none mapped. Populate the Systems & Data tab")
}

## Estimated Effort

- **High-complexity integrations:** ${systems.filter((s) => s.integrationComplexity === "high").length}
- **Recommendation:** Dedicated 2-week integration sprint before pilot start${systems.filter((s) => s.integrationComplexity === "high").length > 0 ? " — high-complexity integrations require early scoping" : ""}`,

    dataReadinessAssessment: `# Data Readiness Assessment — ${name}

**Overall status: ${dataSources.length === 0 ? "⚠ INCOMPLETE — no data sources mapped" : dataSources.every((d) => d.quality === "good" && d.accessStatus === "available") ? "✅ READY" : "⚠ ACTION REQUIRED"}**

${
  dataSources.length > 0
    ? `## Source-by-Source Assessment

${dataSources
  .map(
    (d) => `### ${d.name}

| Attribute | Value |
|---|---|
| **Type** | ${humanise(d.dataType)} |
| **Format** | ${humanise(d.format)} |
| **Quality** | ${humanise(d.quality)} |
| **Access** | ${humanise(d.accessStatus)} |
| **PII** | ${d.pii ? "Yes" : "No"} |
| **Volume** | ${d.volumeEstimate || "Not specified"} |

${d.quality === "poor" ? "> ⚠ **Data remediation required** before training can begin." : ""}
${d.accessStatus === "blocked" ? "> ✕ **Access blocked** — must be unblocked before pilot start." : ""}`,
  )
  .join("\n\n")}`
    : callout(
        "Data sources — none documented yet. Populate the Systems & Data tab",
      )
}

## Key Risks

${
  dataSources.filter(
    (d) => d.quality === "poor" || d.accessStatus === "blocked",
  ).length > 0
    ? dataSources
        .filter((d) => d.quality === "poor" || d.accessStatus === "blocked")
        .map(
          (d) =>
            `- **${d.name}**: ${d.quality === "poor" ? "poor data quality" : ""}${d.quality === "poor" && d.accessStatus === "blocked" ? " + " : ""}${d.accessStatus === "blocked" ? "access blocked" : ""}`,
        )
        .join("\n")
    : "No critical data risks identified at this stage."
}

## Recommendations

- Define minimum data quality thresholds as a pilot launch criterion
- Obtain sample datasets for model validation before committing to a go-live date
${dataSources.some((d) => d.pii === true) ? "- Confirm DPA is signed before transferring any PII data" : ""}`,

    implementationPlan: `# Implementation Plan — ${name}

## Phase 1 — Discovery & Scoping (Weeks 1–2)

Complete workflow mapping, resolve missing information items, finalise integration approach, and agree pilot scope and success metrics.

**Key outputs:** Completed requirements matrix, confirmed integration design${regs ? `, signed DPA (required for ${regs} compliance)` : ""}.

## Phase 2 — Integration & Setup (Weeks 3–6)

Build integrations with ${systems.length > 0 ? systems.map((s) => `**${s.name}**`).join(", ") : "customer systems"}. Set up staging environment, data pipelines, and access controls.

**Dependencies:** API access confirmed for all in-scope systems, staging environment provisioned.

## Phase 3 — Pilot Preparation (Weeks 6–7)

Model validation, end-user training, and launch criteria review. All launch criteria must be met before proceeding.

**Go / no-go gate:** All launch criteria confirmed as met.

## Phase 4 — Pilot (${pilotPlan ? `${pilotPlan.durationWeeks} weeks` : "8 weeks"})

Live deployment with ${pilotPlan?.pilotUsers.length ? `${pilotPlan.pilotUsers.length} pilot users` : "selected pilot users"}. Weekly performance reviews against agreed success metrics.

## Phase 5 — Pilot Review & Rollout Decision

Evaluate results against success metrics. Present to executive sponsor. Decision: **full rollout**, **extended pilot**, or **pause**.

## Phase 6 — Full Rollout (timeline TBD)

Phased rollout to full user base. Ongoing support, monitoring, and quarterly business reviews.

---

**Implementation deadline:** ${discovery.implementationDeadline || "⚠ Not yet set — must be agreed before kick-off"}`,

    riskRegisterSummary: `# Risk Register Summary — ${name}

**${risks.length} risks identified** · ${risks.filter((r) => r.severity === "critical").length} critical · ${risks.filter((r) => r.severity === "high").length} high · ${risks.filter((r) => r.status === "open").length} open

Overall deployment risk: **${humanise(discovery.riskLevel)}**

## Critical & High Risks

${
  criticalRisks.length > 0
    ? criticalRisks
        .map(
          (r) => `### ${r.title}

- **Severity:** ${humanise(r.severity)}
- **Likelihood:** ${humanise(r.likelihood)}
- **Status:** ${humanise(r.status)}
- **Mitigation:** ${r.mitigation || "To be defined"}
${r.escalationTrigger ? `- **Escalation trigger:** ${r.escalationTrigger}` : ""}`,
        )
        .join("\n\n")
    : "No critical or high risks identified at this stage."
}

## Risk Status Summary

| Status | Count |
|---|---|
| Open | ${risks.filter((r) => r.status === "open").length} |
| Mitigating | ${risks.filter((r) => r.status === "mitigating").length} |
| Accepted | ${risks.filter((r) => r.status === "accepted").length} |
| Resolved | ${risks.filter((r) => r.status === "resolved").length} |

**Recommendation:** Monthly risk review during pilot. Escalate any critical risk that becomes "mitigating" to executive sponsor.`,

    pilotSuccessPlan: `# Pilot Success Plan — ${name}

## Objective

${pilotPlan?.objective || callout("Pilot objective")}

## Scope & Duration

- **Scope:** ${pilotPlan?.scope || callout("Pilot scope")}
- **Duration:** ${pilotPlan ? `${pilotPlan.durationWeeks} weeks` : "8 weeks (recommended)"}
- **Pilot users:** ${pilotPlan?.pilotUsers.length ? pilotPlan.pilotUsers.map((u) => `**${u}**`).join(", ") : callout("Pilot users — to be named by the customer")}

## Included Workflows

${pilotPlan?.includedWorkflows.length ? pilotPlan.includedWorkflows.map((w) => `- ${w}`).join("\n") : workflows.length > 0 ? workflows.map((w) => `- ${w.name}`).join("\n") : callout("Included workflows — not yet defined")}

${pilotPlan?.excludedWorkflows.length ? `## Excluded Workflows\n\n${pilotPlan.excludedWorkflows.map((w) => `- ${w}`).join("\n")}` : ""}

## Success Metrics

${
  pilotPlan?.successMetrics.length
    ? `| Metric | Baseline | Target | Method | Owner |
|---|---|---|---|---|
${pilotPlan.successMetrics.map((m) => `| ${m.name} | ${m.baseline || "—"} | ${m.target || "—"} | ${m.measurementMethod || "—"} | ${m.owner || "—"} |`).join("\n")}`
    : callout(
        "Success metrics — add at least one measurable metric before pilot launch",
      )
}

## Launch Criteria

${pilotPlan?.launchCriteria.length ? pilotPlan.launchCriteria.map((c) => `- [ ] ${c}`).join("\n") : callout("Launch criteria — must be agreed before pilot start")}

## Rollback Criteria

${pilotPlan?.rollbackCriteria.length ? pilotPlan.rollbackCriteria.map((c) => `- ${c}`).join("\n") : callout("Rollback criteria — must be agreed before pilot start")}`,

    stakeholderCommunicationPlan: `# Stakeholder Communication Plan — ${name}

This plan outlines how each stakeholder group at **${name}** will be engaged throughout deployment.

${
  stakeholders.length > 0
    ? stakeholders
        .map(
          (s) => `## ${s.name} — ${s.role}

- **Team:** ${s.team}
- **Involvement:** ${humanise(s.involvement)}
- **Concerns:** ${s.concerns.filter(Boolean).length > 0 ? s.concerns.join("; ") : "Not documented"}
- **Required actions:** ${s.requiredActions.filter(Boolean).length > 0 ? s.requiredActions.join("; ") : "Not documented"}
- **Cadence:** ${s.involvement === "sponsor" ? "Monthly executive briefing + pilot sign-off meeting" : s.involvement === "technical_owner" ? "Weekly technical sync during integration phase" : "Bi-weekly status update"}`,
        )
        .join("\n\n")
    : callout(
        "Stakeholders — none mapped yet. Stakeholder identification is an urgent action item",
      )
}

## Communication Channels

- **Slack:** #${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-ai-deployment
- **Status emails:** Weekly to all stakeholders
- **Executive review:** Monthly (sponsor + CSM)
- **Escalation path:** CSM → Head of Deployment → VP Customer Success`,

    engineeringHandoff: `# Engineering Handoff — ${name}

This document summarises the technical requirements and integration specifics for the engineering team.

## Customer Environment

${
  systems.length > 0
    ? `| System | Type | API | Access Method | Auth | Sensitivity |
|---|---|---|---|---|---|
${systems.map((s) => `| **${s.name}** | ${humanise(s.type)} | ${s.apiAvailable ? "✅ Yes" : "❌ No"} | ${humanise(s.accessMethod)} | ${s.authenticationMethod || "TBD"} | ${humanise(s.dataSensitivity)} |`).join("\n")}`
    : callout(
        "Systems — not yet mapped. Populate the Systems tab before handoff",
      )
}

## Data Sources

${
  dataSources.length > 0
    ? `| Source | Type | Format | Quality | Access | PII |
|---|---|---|---|---|---|
${dataSources.map((d) => `| **${d.name}** | ${humanise(d.dataType)} | ${humanise(d.format)} | ${humanise(d.quality)} | ${humanise(d.accessStatus)} | ${d.pii ? "✅ Yes" : "No"} |`).join("\n")}`
    : callout("Data sources — not yet mapped")
}

## Integration Blockers

${
  blockedSystems.length > 0 ||
  dataSources.filter((d) => d.accessStatus === "blocked").length > 0
    ? [
        ...blockedSystems.map(
          (s) => `- **${s}**: No API available — custom integration required`,
        ),
        ...dataSources
          .filter((d) => d.accessStatus === "blocked")
          .map(
            (d) =>
              `- **${d.name}**: Data access blocked — awaiting customer action`,
          ),
      ].join("\n")
    : "No blockers identified at this stage."
}

## Security & Compliance Requirements

${regs ? `- Regulatory compliance required: **${regs}**` : "- No specific regulatory requirements identified."}
${dataSources.some((d) => d.pii === true) ? "- PII data present — encryption at rest and in transit required\n- DPA must be signed before any data transfer" : ""}
- Audit trail required for all AI-assisted decisions

## Environment Setup Checklist

- [ ] Staging environment provisioned
- [ ] Auth method confirmed per system (see table above)
- [ ] Monitoring dashboards set up (latency, error rate, throughput)
- [ ] Data pipeline tested end-to-end in staging
- [ ] Rollback plan documented and tested`,

    productFeedbackMemo: `# Product Feedback Memo — ${name}

**Engagement context:** ${industry} · ${companySize} · ${humanise(customer.urgency)} urgency${regs ? ` · Regulated (${regs})` : ""}

## Integration Gaps

${blockedSystems.length > 0 ? blockedSystems.map((s) => `- **${s}**: No API available. Custom integration work that should be handled by a pre-built connector — recommend adding to the integration library.`).join("\n") : "No significant integration gaps identified in this engagement."}

## Data Quality Issues

${
  dataSources.filter((d) => d.quality === "poor" || d.quality === "mixed")
    .length > 0
    ? dataSources
        .filter((d) => d.quality === "poor" || d.quality === "mixed")
        .map(
          (d) =>
            `- **${d.name}**: ${humanise(d.quality)} quality. Customers need clearer guidance on minimum data quality requirements before signing.`,
        )
        .join("\n")
    : "No data quality issues to flag from this engagement."
}

## Compliance Friction

${customer.regulatoryContext.length > 0 ? `Customer is subject to **${regs}**. The product does not currently have pre-built compliance documentation to accelerate legal review — this added significant friction.\n\n**Recommendation:** Create a compliance pack template for ${industry} customers.` : "No compliance friction in this engagement."}

## Feature Requests

- Self-service audit trail export for customer compliance teams
- Data quality scoring tool to help customers assess readiness before engagement
- Pre-built integration templates for common ${industry} systems

## Account Note

This customer could be a **strong reference case** if the pilot succeeds. Recommend treating as a priority engagement and flagging for case study outreach post-pilot.`,

    nextActionsChecklist: `# Next Actions Checklist — ${name}

## For ${name} (Customer)

${
  [
    !discovery.currentProcess &&
      "- [ ] Provide full current process documentation to the deployment team",
    stakeholders.length === 0 &&
      "- [ ] Name technical owner, executive sponsor, and end-user pilot participants",
    ...dataSources
      .filter((d) => d.accessStatus === "blocked")
      .map((d) => `- [ ] Unblock data access for **${d.name}**`),
    ...blockedSystems.map(
      (s) =>
        `- [ ] Confirm integration approach for **${s}** (no API available)`,
    ),
    customer.regulatoryContext.length > 0 &&
      "- [ ] Engage legal/procurement to begin DPA review",
    !discovery.successDefinition &&
      "- [ ] Define measurable success criteria for the pilot",
    !discovery.implementationDeadline &&
      "- [ ] Confirm implementation deadline",
  ]
    .filter(Boolean)
    .join("\n") ||
  "- [ ] Review the deployment plan and confirm readiness to proceed"
}

## For the Deployment Team

- [ ] Send discovery summary and this checklist to the customer within 24 hours
- [ ] Schedule integration scoping session with ${stakeholders.find((s) => s.involvement === "technical_owner")?.name ? `**${stakeholders.find((s) => s.involvement === "technical_owner")!.name}**` : "customer technical owner"}
- [ ] Draft pilot plan and circulate for customer review
${customer.regulatoryContext.length > 0 ? "- [ ] Prepare compliance documentation pack for customer legal review" : ""}
- [ ] Set up dedicated Slack channel and share with customer stakeholders
- [ ] Book weekly pilot check-in cadence with ${discovery.buyerTeam ? `**${discovery.buyerTeam}**` : "customer team"}
- [ ] Confirm all launch criteria with customer before pilot start

---

> All items above should be completed within **14 days** of this document being shared.`,
  };
}

// Live preview of a single artifact, computed synchronously from the current
// project state via the template path (no LLM round-trip).
// Only narrows to string-typed artifact keys (excludes derivedFromHash etc).
export type ArtifactPreviewKey = Exclude<
  keyof GeneratedArtifacts,
  "derivedFromHash" | "generatedAt"
>;

export function previewArtifact(
  project: OnboardingProject,
  key: ArtifactPreviewKey,
): string {
  const all = generateTemplateArtifacts(project);
  return all[key] ?? "";
}
