import type {
  OnboardingProject,
  MissingInfoItem,
  MissingInfoOwner,
  MissingInfoRelatedTab,
} from "./types";
import { generateId } from "./utils";

function item(
  text: string,
  whyItMatters: string,
  owner: MissingInfoOwner,
  tab: MissingInfoRelatedTab,
): MissingInfoItem {
  return {
    id: generateId(),
    item: text,
    whyItMatters,
    suggestedOwner: owner,
    relatedTab: tab,
  };
}

export function detectMissingInfo(
  project: OnboardingProject,
): MissingInfoItem[] {
  const results: MissingInfoItem[] = [];

  // ── Discovery gaps ────────────────────────────────────────────────────────
  if (!project.discovery.currentProcess) {
    results.push(
      item(
        "Current process not documented",
        "Without a baseline process description, it's impossible to scope the AI integration or measure improvement.",
        "customer",
        "discovery",
      ),
    );
  }
  if (!project.discovery.successDefinition) {
    results.push(
      item(
        "Success definition not specified",
        "Pilot sign-off criteria cannot be agreed until both parties define what 'success' looks like in measurable terms.",
        "customer",
        "discovery",
      ),
    );
  }
  if (!project.discovery.implementationDeadline) {
    results.push(
      item(
        "Implementation deadline not set",
        "Without a deadline, scope management is impossible and the project may drift.",
        "customer",
        "discovery",
      ),
    );
  }

  // ── Stakeholders ──────────────────────────────────────────────────────────
  if (project.stakeholders.length === 0) {
    results.push(
      item(
        "No stakeholders identified",
        "Without named stakeholders, approval, escalation, and change management planning cannot proceed.",
        "customer",
        "discovery",
      ),
    );
  } else {
    const hasTechOwner = project.stakeholders.some(
      (s) => s.involvement === "technical_owner",
    );
    if (!hasTechOwner) {
      results.push(
        item(
          "No technical owner identified",
          "A named technical owner is required for API access, environment setup, and integration sign-off.",
          "customer",
          "discovery",
        ),
      );
    }
    const hasSponsor = project.stakeholders.some(
      (s) => s.involvement === "sponsor",
    );
    if (!hasSponsor) {
      results.push(
        item(
          "No executive sponsor identified",
          "Executive sponsorship is critical for budget approval, change management, and escalation path.",
          "customer",
          "discovery",
        ),
      );
    }
  }

  // ── Systems ───────────────────────────────────────────────────────────────
  for (const system of project.systems) {
    if (system.accessMethod === "unknown") {
      results.push(
        item(
          `Access method unknown: ${system.name}`,
          `Integration design for ${system.name} cannot begin until the access method (API, DB, export) is confirmed.`,
          "engineering",
          "systems",
        ),
      );
    }
    if (system.apiAvailable === "unknown") {
      results.push(
        item(
          `API availability unknown: ${system.name}`,
          `If ${system.name} has no API, a custom integration must be scoped — unknown status blocks technical planning.`,
          "engineering",
          "systems",
        ),
      );
    }
    if (!system.authenticationMethod) {
      results.push(
        item(
          `Authentication method unknown: ${system.name}`,
          `Authentication details for ${system.name} are required before environment configuration and security review.`,
          "engineering",
          "systems",
        ),
      );
    }
  }

  // ── Data sources ──────────────────────────────────────────────────────────
  for (const source of project.dataSources) {
    if (source.accessStatus === "unknown") {
      results.push(
        item(
          `Data access status unknown: ${source.name}`,
          `Pilot planning cannot confirm data availability for ${source.name} until access status is resolved.`,
          "customer",
          "systems",
        ),
      );
    }
    if (source.accessStatus === "blocked") {
      results.push(
        item(
          `Data access blocked: ${source.name}`,
          `${source.name} access is blocked — resolve this before the pilot depends on it.`,
          "customer",
          "systems",
        ),
      );
    }
    if (source.pii === "unknown") {
      results.push(
        item(
          `PII classification unknown: ${source.name}`,
          `PII status of ${source.name} must be confirmed before data processing agreements and security controls can be finalised.`,
          "security",
          "systems",
        ),
      );
    }
    if (source.openQuestions.length > 0) {
      results.push(
        item(
          `Open questions on ${source.name}: ${source.openQuestions[0]}${source.openQuestions.length > 1 ? ` (+${source.openQuestions.length - 1} more)` : ""}`,
          `Unresolved data source questions could block integration or training data preparation.`,
          "customer",
          "systems",
        ),
      );
    }
  }

  // ── Workflow gaps ─────────────────────────────────────────────────────────
  const stepsWithNoSystem = project.workflows.filter((w) => !w.currentSystem);
  if (stepsWithNoSystem.length > 0) {
    results.push(
      item(
        `${stepsWithNoSystem.length} workflow step${stepsWithNoSystem.length > 1 ? "s" : ""} missing current system`,
        "System mapping is required to identify integration points and assess automation feasibility.",
        "customer",
        "workflow",
      ),
    );
  }

  // ── Pilot ─────────────────────────────────────────────────────────────────
  if (!project.pilotPlan) {
    results.push(
      item(
        "Pilot plan not started",
        "Without a pilot plan, launch criteria, rollback conditions, and success metrics cannot be agreed with the customer.",
        "unknown",
        "pilot",
      ),
    );
  } else {
    if (project.pilotPlan.successMetrics.length === 0) {
      results.push(
        item(
          "No success metrics defined in pilot plan",
          "Quantitative success metrics are required to sign off on the pilot and justify full rollout.",
          "customer",
          "pilot",
        ),
      );
    }
    if (project.pilotPlan.launchCriteria.length === 0) {
      results.push(
        item(
          "No launch criteria defined",
          "Without agreed launch criteria, go/no-go decisions will be subjective and disputed.",
          "customer",
          "pilot",
        ),
      );
    }
  }

  // ── Commercial ────────────────────────────────────────────────────────────
  if (
    project.customer.regulatoryContext.length > 0 &&
    !project.discovery.constraints.toLowerCase().includes("dpa")
  ) {
    results.push(
      item(
        "Data processing agreement (DPA) status unknown",
        "Regulated context detected — a signed DPA may be legally required before data is processed. Confirm with legal/commercial.",
        "commercial",
        "discovery",
      ),
    );
  }

  return results;
}
