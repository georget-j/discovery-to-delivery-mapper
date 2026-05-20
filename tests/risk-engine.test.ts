import { describe, it, expect } from "vitest";
import { generateRisks } from "../lib/risk-engine";
import fintechScenario from "../data/scenarios/fintech-aml-onboarding.json";
import legaltechScenario from "../data/scenarios/legaltech-contract-review.json";
import type { OnboardingProject } from "../lib/types";

const fintech = fintechScenario as unknown as OnboardingProject;
const legaltech = legaltechScenario as unknown as OnboardingProject;

describe("generateRisks", () => {
  it("generates risks from a populated fintech project", () => {
    const risks = generateRisks(fintech);
    expect(risks.length).toBeGreaterThan(0);
  });

  it("generates integration risk for systems with no API", () => {
    const project: OnboardingProject = {
      ...fintech,
      systems: [{ ...fintech.systems[0], apiAvailable: false, name: "OldCoreSystem" }],
    };
    const risks = generateRisks(project);
    const integrationRisk = risks.find((r) => r.category === "integration" && r.title.includes("OldCoreSystem"));
    expect(integrationRisk).toBeDefined();
    expect(integrationRisk?.severity).toBe("high");
  });

  it("generates security risk when regulated data is present", () => {
    const risks = generateRisks(fintech);
    const secRisk = risks.find((r) => r.category === "security");
    expect(secRisk).toBeDefined();
    expect(secRisk?.severity).toBe("high");
  });

  it("generates data readiness risk for blocked data source", () => {
    const project: OnboardingProject = {
      ...fintech,
      dataSources: [{ ...fintech.dataSources[0], accessStatus: "blocked", name: "TransactionDB" }],
    };
    const risks = generateRisks(project);
    const blockedRisk = risks.find((r) => r.title.includes("Blocked data access") && r.title.includes("TransactionDB"));
    expect(blockedRisk).toBeDefined();
    expect(blockedRisk?.severity).toBe("critical");
  });

  it("generates stakeholder alignment risk when no technical owner exists", () => {
    const project: OnboardingProject = {
      ...fintech,
      stakeholders: fintech.stakeholders.filter((s) => s.involvement !== "technical_owner"),
    };
    const risks = generateRisks(project);
    const alignmentRisk = risks.find((r) => r.category === "stakeholder_alignment" && r.title.includes("technical owner"));
    expect(alignmentRisk).toBeDefined();
    expect(alignmentRisk?.severity).toBe("high");
  });

  it("generates fintech-specific explainability risk", () => {
    const risks = generateRisks(fintech);
    const explainabilityRisk = risks.find((r) => r.title.toLowerCase().includes("explainability"));
    expect(explainabilityRisk).toBeDefined();
    expect(explainabilityRisk?.category).toBe("legal_procurement");
  });

  it("generates fintech-specific audit trail risk", () => {
    const risks = generateRisks(fintech);
    const auditRisk = risks.find((r) => r.title.toLowerCase().includes("audit trail"));
    expect(auditRisk).toBeDefined();
  });

  it("generates legaltech-specific hallucination risk as critical", () => {
    const risks = generateRisks(legaltech);
    const hallucinationRisk = risks.find((r) => r.title.toLowerCase().includes("hallucination"));
    expect(hallucinationRisk).toBeDefined();
    expect(hallucinationRisk?.severity).toBe("critical");
    expect(hallucinationRisk?.category).toBe("model_quality");
  });

  it("generates legaltech-specific privilege risk", () => {
    const risks = generateRisks(legaltech);
    const privilegeRisk = risks.find((r) => r.title.toLowerCase().includes("privilege"));
    expect(privilegeRisk).toBeDefined();
    expect(privilegeRisk?.severity).toBe("critical");
  });

  it("does not duplicate risks with same title", () => {
    const risks = generateRisks(fintech);
    const titles = risks.map((r) => r.title);
    const uniqueTitles = new Set(titles);
    expect(titles.length).toBe(uniqueTitles.size);
  });

  it("all generated risks have required fields", () => {
    const risks = generateRisks(fintech);
    for (const risk of risks) {
      expect(risk.id).toBeTruthy();
      expect(risk.title).toBeTruthy();
      expect(risk.category).toBeTruthy();
      expect(risk.severity).toMatch(/^(low|medium|high|critical)$/);
      expect(risk.likelihood).toMatch(/^(low|medium|high)$/);
      expect(risk.status).toBe("open");
    }
  });

  it("generates an 'incomplete discovery' risk when urgency is critical + currentProcess empty", () => {
    const project: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, urgency: "critical" },
      discovery: { ...fintech.discovery, currentProcess: "" },
    };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.toLowerCase().includes("incomplete discovery") && r.category === "timeline")).toBe(true);
  });

  it("generates 'aggressive timeline' risk when high urgency + blocked data", () => {
    const project: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, urgency: "high" },
      dataSources: [{ ...fintech.dataSources[0], accessStatus: "blocked" }],
    };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.toLowerCase().includes("aggressive timeline"))).toBe(true);
  });

  it("generates 'aggressive timeline' risk when high urgency + missing API", () => {
    const project: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, urgency: "high" },
      systems: [{ ...fintech.systems[0], apiAvailable: false }],
    };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.toLowerCase().includes("aggressive timeline"))).toBe(true);
  });

  it("generates low-maturity adoption risk for low-maturity customer", () => {
    const project: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, technicalMaturity: "low" },
    };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.category === "operational_adoption")).toBe(true);
  });

  it("generates 'no success metrics' risk when pilot is missing", () => {
    const project: OnboardingProject = { ...fintech, pilotPlan: null };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.toLowerCase().includes("success metrics"))).toBe(true);
  });

  it("generates 'no success metrics' risk when pilot exists but metrics empty", () => {
    if (!fintech.pilotPlan) return;
    const project: OnboardingProject = {
      ...fintech,
      pilotPlan: { ...fintech.pilotPlan, successMetrics: [] },
    };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.toLowerCase().includes("success metrics"))).toBe(true);
  });

  it("generates legal_procurement risk when regulatory context is present", () => {
    const risks = generateRisks(fintech);
    expect(risks.some((r) => r.category === "legal_procurement")).toBe(true);
  });

  it("generates 'no stakeholders' risk when stakeholders array is empty", () => {
    const project: OnboardingProject = { ...fintech, stakeholders: [] };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.toLowerCase().includes("no stakeholders"))).toBe(true);
  });

  it("generates 'high integration complexity' risk for complex systems", () => {
    const project: OnboardingProject = {
      ...fintech,
      systems: [{ ...fintech.systems[0], integrationComplexity: "high", name: "ComplexSystem" }],
    };
    const risks = generateRisks(project);
    expect(risks.some((r) => r.title.includes("ComplexSystem") && r.title.toLowerCase().includes("complexity"))).toBe(true);
  });

  it("blank project (no risks/systems/data) still yields baseline risks", () => {
    const blank: OnboardingProject = {
      ...fintech,
      workflows: [], systems: [], dataSources: [], stakeholders: [], risks: [],
      customer: { ...fintech.customer, regulatoryContext: [], technicalMaturity: "medium", urgency: "medium", industry: "other" },
      pilotPlan: null,
    };
    const risks = generateRisks(blank);
    // At least "no stakeholders", "no technical owner", "no success metrics", "no pilot" → 3+
    expect(risks.length).toBeGreaterThanOrEqual(3);
  });
});
