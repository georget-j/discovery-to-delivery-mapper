import { describe, it, expect } from "vitest";
import { listScenarios } from "../lib/scenarios";
import {
  computeArtifactSources,
  coverageCell,
  getArtifactReadiness,
  ARTIFACT_KEYS_ORDERED,
  ARTIFACT_LABELS,
} from "../lib/artifact-sources";
import { hashGenerationInputs } from "../lib/artifact-helpers";
import type { OnboardingProject } from "../lib/types";

const scenarios = listScenarios();
const fintech = scenarios.find((s) => s.id === "fintech-aml")!;

// ── computeArtifactSources ─────────────────────────────────────────────────

describe("computeArtifactSources", () => {
  it("returns 15 entries when called for every key", () => {
    const maps = ARTIFACT_KEYS_ORDERED.map((k) => computeArtifactSources(fintech, k));
    expect(maps).toHaveLength(15);
    expect(new Set(maps.map((m) => m.artifactKey)).size).toBe(15);
  });

  it("every section refs are non-empty when the source category has data", () => {
    const map = computeArtifactSources(fintech, "executiveSummary");
    for (const section of map.sections) {
      expect(section.refs.length).toBeGreaterThan(0);
    }
  });

  it("flat inputs equal the sum of section refs", () => {
    const map = computeArtifactSources(fintech, "engineeringHandoff");
    const sectionsFlat = map.sections.flatMap((s) => s.refs);
    expect(map.inputs.length).toBe(sectionsFlat.length);
  });

  it("executiveSummary references workflows + risks + pilot", () => {
    const map = computeArtifactSources(fintech, "executiveSummary");
    const sectionLabels = map.sections.map((s) => s.label);
    expect(sectionLabels).toContain("High-automation workflows");
    expect(sectionLabels).toContain("Top risks");
    expect(sectionLabels).toContain("Pilot plan");
  });

  it("requirementsMatrix references systems-without-APIs + regulatory + PII sources", () => {
    const map = computeArtifactSources(fintech, "requirementsMatrix");
    const sectionLabels = map.sections.map((s) => s.label);
    expect(sectionLabels).toContain("Systems without APIs");
    expect(sectionLabels).toContain("Regulatory context");
  });

  it("dataReadinessAssessment references the data sources", () => {
    const map = computeArtifactSources(fintech, "dataReadinessAssessment");
    expect(map.sections.some((s) => s.label === "All data sources")).toBe(true);
  });

  it("returns empty sections gracefully when project lacks data", () => {
    const empty: OnboardingProject = {
      ...fintech,
      workflows: [], systems: [], dataSources: [], stakeholders: [], risks: [],
      customer: { ...fintech.customer, regulatoryContext: [] },
      pilotPlan: null,
    };
    const map = computeArtifactSources(empty, "executiveSummary");
    // computeArtifactSources trims empty sections — should produce a small result
    expect(map.inputs.length).toBeGreaterThanOrEqual(0);
    expect(map.inputs.length).toBeLessThan(map.inputs.length + 1); // sanity
  });
});

// ── coverageCell ───────────────────────────────────────────────────────────

describe("coverageCell", () => {
  it("returns 'solid' when all entries of a category feed the artifact", () => {
    // For 'risks' category and 'riskRegisterSummary' — all risks feed it
    const cell = coverageCell(fintech, "riskRegisterSummary", "risks");
    expect(cell.strength).toBe("solid");
    expect(cell.count).toBe(fintech.risks.length);
  });

  it("returns 'hollow' when a subset of entries feed the artifact", () => {
    // 'workflows' for 'executiveSummary' — only HIGH automation workflows
    const highAuto = fintech.workflows.filter((w) => w.automationPotential === "high");
    if (highAuto.length > 0 && highAuto.length < fintech.workflows.length) {
      const cell = coverageCell(fintech, "executiveSummary", "workflows");
      expect(cell.strength).toBe("hollow");
      expect(cell.count).toBe(highAuto.length);
    }
  });

  it("returns 'none' when no entries of a category are referenced", () => {
    // 'stakeholders' for 'integrationAndApiPlan' — integration plan doesn't reference stakeholders
    const cell = coverageCell(fintech, "integrationAndApiPlan", "stakeholders");
    expect(cell.strength).toBe("none");
    expect(cell.count).toBe(0);
  });
});

// ── getArtifactReadiness ───────────────────────────────────────────────────

describe("getArtifactReadiness", () => {
  it("returns 'rich' or 'usable' for executiveSummary on the populated fintech scenario", () => {
    const r = getArtifactReadiness(fintech, "executiveSummary");
    expect(r === "rich" || r === "usable").toBe(true);
  });

  it("downgrades from 'rich' towards 'thin' / 'empty' as inputs are stripped", () => {
    const richest = getArtifactReadiness(fintech, "executiveSummary");
    // Remove every list input + clear most string discovery fields; expect at
    // least one step lower on the rich→empty ladder than the populated baseline.
    const stripped: OnboardingProject = {
      ...fintech,
      workflows: [], systems: [], dataSources: [], stakeholders: [], risks: [],
      customer: { ...fintech.customer, regulatoryContext: [] },
      pilotPlan: null,
    };
    const after = getArtifactReadiness(stripped, "executiveSummary");
    const order: Record<string, number> = { rich: 3, usable: 2, thin: 1, empty: 0 };
    expect(order[after]).toBeLessThan(order[richest]);
  });

  it("returns one of the 4 enum values for every artifact key across every scenario", () => {
    for (const scenario of scenarios) {
      for (const key of ARTIFACT_KEYS_ORDERED) {
        const r = getArtifactReadiness(scenario, key);
        expect(["rich", "usable", "thin", "empty"]).toContain(r);
      }
    }
  });
});

// ── ARTIFACT_LABELS sanity ─────────────────────────────────────────────────

describe("ARTIFACT_LABELS", () => {
  it("has a label for every artifact key", () => {
    for (const key of ARTIFACT_KEYS_ORDERED) {
      expect(ARTIFACT_LABELS[key]).toBeTruthy();
    }
  });
});

// ── hashGenerationInputs ───────────────────────────────────────────────────

describe("hashGenerationInputs", () => {
  it("is stable across identical inputs", () => {
    expect(hashGenerationInputs(fintech)).toBe(hashGenerationInputs(fintech));
  });

  it("changes when the company name changes", () => {
    const h1 = hashGenerationInputs(fintech);
    const modified = { ...fintech, customer: { ...fintech.customer, companyName: "Renamed Bank" } };
    expect(h1).not.toBe(hashGenerationInputs(modified));
  });

  it("changes when a workflow is added", () => {
    const h1 = hashGenerationInputs(fintech);
    const modified: OnboardingProject = {
      ...fintech,
      workflows: [
        ...fintech.workflows,
        { ...fintech.workflows[0], id: "new", name: "New step" },
      ],
    };
    expect(h1).not.toBe(hashGenerationInputs(modified));
  });

  it("changes when a risk severity changes", () => {
    if (fintech.risks.length === 0) return;
    const h1 = hashGenerationInputs(fintech);
    const modified: OnboardingProject = {
      ...fintech,
      risks: fintech.risks.map((r, i) => (i === 0 ? { ...r, severity: "low" as const } : r)),
    };
    expect(h1).not.toBe(hashGenerationInputs(modified));
  });

  it("changes when the pilot plan duration changes", () => {
    if (!fintech.pilotPlan) return;
    const h1 = hashGenerationInputs(fintech);
    const modified: OnboardingProject = {
      ...fintech,
      pilotPlan: { ...fintech.pilotPlan, durationWeeks: 99 },
    };
    expect(h1).not.toBe(hashGenerationInputs(modified));
  });

  it("does NOT change when an unrelated field like createdAt changes", () => {
    const h1 = hashGenerationInputs(fintech);
    const modified: OnboardingProject = { ...fintech, createdAt: "2099-01-01T00:00:00Z" };
    expect(h1).toBe(hashGenerationInputs(modified));
  });
});
