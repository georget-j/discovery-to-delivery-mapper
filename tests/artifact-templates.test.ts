import { describe, it, expect } from "vitest";
import { listScenarios } from "../lib/scenarios";
import { generateTemplateArtifacts } from "../lib/artifact-templates";
import { GeneratedArtifactsSchema } from "../lib/schemas";
import { ARTIFACT_SPECS } from "../lib/prompts";
import type { OnboardingProject } from "../lib/types";

const scenarios = listScenarios();
const fintech = scenarios.find((s) => s.id === "fintech-aml")!;

describe("generateTemplateArtifacts", () => {
  it("returns all 15 artifact keys", () => {
    const artifacts = generateTemplateArtifacts(fintech);
    for (const spec of ARTIFACT_SPECS) {
      expect(artifacts[spec.key as keyof typeof artifacts]).toBeTruthy();
    }
  });

  it("every artifact is a non-empty string of meaningful length", () => {
    const artifacts = generateTemplateArtifacts(fintech);
    for (const spec of ARTIFACT_SPECS) {
      const content = artifacts[spec.key as keyof typeof artifacts] as string;
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(50);
    }
  });

  it("output passes GeneratedArtifactsSchema validation", () => {
    const artifacts = generateTemplateArtifacts(fintech);
    const result = GeneratedArtifactsSchema.safeParse(artifacts);
    expect(result.success).toBe(true);
  });

  it("artifacts reference the actual customer name", () => {
    const artifacts = generateTemplateArtifacts(fintech);
    expect(artifacts.executiveSummary).toContain(fintech.customer.companyName);
    expect(artifacts.customerDiscoverySummary).toContain(fintech.customer.companyName);
  });

  it("riskRegisterSummary surfaces the project's risk count", () => {
    const artifacts = generateTemplateArtifacts(fintech);
    expect(artifacts.riskRegisterSummary).toMatch(/\d+ risk/);
  });

  it("missingInformationLog is generated even when nothing is missing", () => {
    const complete: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, currentProcess: "x", successDefinition: "y" },
    };
    const artifacts = generateTemplateArtifacts(complete);
    expect(artifacts.missingInformationLog).toBeTruthy();
  });

  it("stakeholderCommunicationPlan handles empty stakeholders gracefully", () => {
    const noStakeholders: OnboardingProject = { ...fintech, stakeholders: [] };
    const artifacts = generateTemplateArtifacts(noStakeholders);
    expect(artifacts.stakeholderCommunicationPlan).toBeTruthy();
    expect(artifacts.stakeholderCommunicationPlan).toMatch(/no stakeholders|urgent action item/i);
  });
});

describe("generateTemplateArtifacts across all seeded scenarios", () => {
  it.each(scenarios.map((s) => [s.id, s] as [string, OnboardingProject]))(
    "produces a valid 15-artifact output for %s",
    (_id, scenario) => {
      const artifacts = generateTemplateArtifacts(scenario);
      const result = GeneratedArtifactsSchema.safeParse(artifacts);
      expect(result.success).toBe(true);
      for (const spec of ARTIFACT_SPECS) {
        const content = artifacts[spec.key as keyof typeof artifacts] as string;
        expect(content).toBeTruthy();
        expect(content.length).toBeGreaterThan(20);
      }
    }
  );
});
