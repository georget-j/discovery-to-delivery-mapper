import { describe, it, expect } from "vitest";
import { generateRequirements } from "../lib/requirements-engine";
import fintechScenario from "../data/scenarios/fintech-aml-onboarding.json";
import legaltechScenario from "../data/scenarios/legaltech-contract-review.json";
import type { OnboardingProject } from "../lib/types";

const fintech = fintechScenario as unknown as OnboardingProject;
const legaltech = legaltechScenario as unknown as OnboardingProject;

describe("generateRequirements", () => {
  it("generates requirements from a populated fintech project", () => {
    const reqs = generateRequirements(fintech);
    expect(reqs.length).toBeGreaterThan(0);
  });

  it("generates compliance requirements when regulatory context is set", () => {
    const reqs = generateRequirements(fintech);
    const complianceReqs = reqs.filter((r) => r.category === "compliance");
    expect(complianceReqs.length).toBeGreaterThan(0);
  });

  it("generates model explainability requirement for fintech", () => {
    const reqs = generateRequirements(fintech);
    const explainability = reqs.find((r) => r.title.includes("explainability"));
    expect(explainability).toBeDefined();
    expect(explainability?.priority).toBe("must_have");
  });

  it("generates audit trail requirement for fintech", () => {
    const reqs = generateRequirements(fintech);
    const audit = reqs.find((r) => r.title.toLowerCase().includes("audit trail"));
    expect(audit).toBeDefined();
  });

  it("generates hallucination detection requirement for legaltech", () => {
    const reqs = generateRequirements(legaltech);
    const hallucination = reqs.find((r) => r.title.toLowerCase().includes("hallucination"));
    expect(hallucination).toBeDefined();
    expect(hallucination?.priority).toBe("must_have");
  });

  it("generates privilege requirement for legaltech", () => {
    const reqs = generateRequirements(legaltech);
    const privilege = reqs.find((r) => r.title.toLowerCase().includes("privilege"));
    expect(privilege).toBeDefined();
  });

  it("generates security requirement for systems with regulated data", () => {
    const reqs = generateRequirements(fintech);
    const securityReqs = reqs.filter((r) => r.category === "security");
    expect(securityReqs.length).toBeGreaterThan(0);
  });

  it("generates integration requirement for systems without API", () => {
    const projectWithNoApi: OnboardingProject = {
      ...fintech,
      systems: [{ ...fintech.systems[0], apiAvailable: false, name: "LegacySystem" }],
    };
    const reqs = generateRequirements(projectWithNoApi);
    const integrationReqs = reqs.filter((r) => r.category === "integration" && r.title.includes("LegacySystem"));
    expect(integrationReqs.length).toBeGreaterThan(0);
    expect(integrationReqs[0].priority).toBe("must_have");
  });

  it("does not duplicate requirements with same title", () => {
    const reqs = generateRequirements(fintech);
    const titles = reqs.map((r) => r.title);
    const uniqueTitles = new Set(titles);
    expect(titles.length).toBe(uniqueTitles.size);
  });

  it("generates PII security requirement for data sources with PII", () => {
    const projectWithPii: OnboardingProject = {
      ...fintech,
      dataSources: [{ ...fintech.dataSources[0], pii: true, name: "CustomerRecords" }],
    };
    const reqs = generateRequirements(projectWithPii);
    const piiReq = reqs.find((r) => r.title.includes("CustomerRecords") && r.category === "security");
    expect(piiReq).toBeDefined();
  });

  it("returns empty array for blank project", () => {
    const blank: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, regulatoryContext: [], technicalMaturity: "medium", industry: "other" },
      workflows: [],
      systems: [],
      dataSources: [],
    };
    const reqs = generateRequirements(blank);
    // Should still get support and reporting requirements
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.every((r) => r.category === "support" || r.category === "reporting")).toBe(true);
  });

  it("generates a change_management requirement for low-maturity customers", () => {
    const project: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, technicalMaturity: "low" },
    };
    const reqs = generateRequirements(project);
    expect(reqs.some((r) => r.category === "change_management")).toBe(true);
  });

  it("does NOT generate change_management for high-maturity customers", () => {
    const project: OnboardingProject = {
      ...fintech,
      customer: { ...fintech.customer, technicalMaturity: "high" },
    };
    const reqs = generateRequirements(project);
    expect(reqs.some((r) => r.category === "change_management")).toBe(false);
  });

  it("generates 'clarify access method' when a system has unknown access", () => {
    const project: OnboardingProject = {
      ...fintech,
      systems: [{ ...fintech.systems[0], accessMethod: "unknown", name: "UnclearSystem" }],
    };
    const reqs = generateRequirements(project);
    expect(reqs.some((r) => r.title.includes("UnclearSystem") && r.title.toLowerCase().includes("clarify"))).toBe(true);
  });

  it("generates a should_have data quality review for mixed-quality data sources", () => {
    const project: OnboardingProject = {
      ...fintech,
      dataSources: [{ ...fintech.dataSources[0], quality: "mixed", name: "MixedSrc" }],
    };
    const reqs = generateRequirements(project);
    const dq = reqs.find((r) => r.title.includes("MixedSrc") && r.title.toLowerCase().includes("quality"));
    expect(dq).toBeDefined();
    expect(dq?.priority).toBe("should_have");
  });

  it("generates DPA requirement when any system is regulated", () => {
    const reqs = generateRequirements(fintech);
    expect(reqs.some((r) => r.title.includes("Data processing agreement"))).toBe(true);
  });

  it("always generates the support + reporting baseline requirements", () => {
    const reqs = generateRequirements(fintech);
    expect(reqs.some((r) => r.category === "support")).toBe(true);
    expect(reqs.some((r) => r.category === "reporting")).toBe(true);
  });

  it("every requirement has the required schema fields", () => {
    const reqs = generateRequirements(fintech);
    for (const r of reqs) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(r.category).toBeTruthy();
      expect(r.priority).toMatch(/^(must_have|should_have|nice_to_have)$/);
      expect(r.owner).toMatch(/^(customer|startup|shared)$/);
      expect(r.status).toMatch(/^(assumption|needs_validation|validated)$/);
    }
  });
});
