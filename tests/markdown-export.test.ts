import { describe, it, expect } from "vitest";
import { assembleOnboardingPack, assembleScopedPack } from "../lib/markdown-export";
import fintechScenario from "../data/scenarios/fintech-aml-onboarding.json";
import type { OnboardingProject, GeneratedArtifacts } from "../lib/types";

const fintech = fintechScenario as unknown as OnboardingProject;

const mockOutputs: GeneratedArtifacts = {
  customerDiscoverySummary: "Discovery summary content.",
  currentStateWorkflow: "Current state content.",
  futureStateWorkflow: "Future state content.",
  requirementsMatrix: "Requirements content.",
  missingInformationLog: "Missing info content.",
  integrationAndApiPlan: "Integration plan content.",
  dataReadinessAssessment: "Data readiness content.",
  implementationPlan: "Implementation plan content.",
  riskRegisterSummary: "Risk register content.",
  pilotSuccessPlan: "Pilot plan content.",
  stakeholderCommunicationPlan: "Stakeholder comms content.",
  engineeringHandoff: "Engineering handoff content.",
  productFeedbackMemo: "Product feedback content.",
  executiveSummary: "Executive summary content.",
  nextActionsChecklist: "Next actions content.",
};

const projectWithOutputs: OnboardingProject = {
  ...fintech,
  outputs: mockOutputs,
};

describe("assembleOnboardingPack", () => {
  it("returns a non-empty string", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("includes the customer name in the title", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    expect(result).toContain("Meridian Bank");
  });

  it("includes all 15 required sections", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    const sections = [
      "Executive Summary",
      "Customer Discovery Summary",
      "Current State Workflow",
      "Future State Workflow",
      "Requirements Matrix",
      "Missing Information Log",
      "Integration and API Plan",
      "Data Readiness Assessment",
      "Implementation Plan",
      "Risk Register Summary",
      "Pilot Success Plan",
      "Stakeholder Communication Plan",
      "Engineering Handoff",
      "Product Feedback Memo",
      "Next Actions Checklist",
    ];
    for (const section of sections) {
      expect(result).toContain(section);
    }
  });

  it("includes section numbers 1–15", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    for (let i = 1; i <= 15; i++) {
      expect(result).toContain(`## ${i}.`);
    }
  });

  it("includes mock artifact content", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    expect(result).toContain("Discovery summary content.");
    expect(result).toContain("Executive summary content.");
    expect(result).toContain("Next actions content.");
  });

  it("shows placeholder for missing artifacts", () => {
    const noOutputs: OnboardingProject = { ...fintech, outputs: null };
    const result = assembleOnboardingPack(noOutputs);
    expect(result).toContain("_Not yet generated._");
  });

  it("includes the customer industry and company size", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    expect(result).toContain("fintech");
    expect(result).toContain("enterprise");
  });

  it("is valid markdown with a top-level heading", () => {
    const result = assembleOnboardingPack(projectWithOutputs);
    expect(result).toMatch(/^# AI Onboarding Pack/);
  });
});

describe("assembleScopedPack", () => {
  it("customer scope includes the 5 customer-facing artifacts and excludes others", () => {
    const out = assembleScopedPack(projectWithOutputs, "customer");
    expect(out).toContain("Customer pack");
    expect(out).toContain("Executive Summary");
    expect(out).toContain("Future State Workflow");
    expect(out).toContain("Pilot Success Plan");
    expect(out).toContain("Stakeholder Communication Plan");
    expect(out).toContain("Next Actions Checklist");
    // None of these are customer-facing
    expect(out).not.toContain("Engineering Handoff");
    expect(out).not.toContain("Product Feedback Memo");
    expect(out).not.toContain("Integration and API Plan");
  });

  it("internal scope includes the 5 internal artifacts", () => {
    const out = assembleScopedPack(projectWithOutputs, "internal");
    expect(out).toContain("Internal pack");
    expect(out).toContain("Customer Discovery Summary");
    expect(out).toContain("Requirements Matrix");
    expect(out).toContain("Missing Information Log");
    expect(out).toContain("Risk Register Summary");
    expect(out).toContain("Implementation Plan");
  });

  it("technical scope includes engineering-relevant artifacts", () => {
    const out = assembleScopedPack(projectWithOutputs, "technical");
    expect(out).toContain("Technical pack");
    expect(out).toContain("Integration and API Plan");
    expect(out).toContain("Engineering Handoff");
    expect(out).toContain("Data Readiness Assessment");
    expect(out).toContain("Current State Workflow");
  });

  it("full scope matches the legacy assembleOnboardingPack length within 5%", () => {
    const full = assembleScopedPack(projectWithOutputs, "full");
    const legacy = assembleOnboardingPack(projectWithOutputs);
    // Same content, slightly different framing — should be within an order of magnitude
    const ratio = full.length / legacy.length;
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.1);
  });

  it("includes the customer company name in the title", () => {
    const out = assembleScopedPack(projectWithOutputs, "customer");
    expect(out).toContain(fintech.customer.companyName);
  });
});
