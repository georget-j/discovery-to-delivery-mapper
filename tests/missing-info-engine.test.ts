import { describe, it, expect } from "vitest";
import { detectMissingInfo } from "../lib/missing-info-engine";
import { listScenarios } from "../lib/scenarios";
import type { OnboardingProject } from "../lib/types";

const scenarios = listScenarios();
const fintech = scenarios.find((s) => s.id === "fintech-aml")!;

describe("detectMissingInfo — discovery gaps", () => {
  it("flags missing currentProcess", () => {
    const project: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, currentProcess: "" },
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("current process"))).toBe(true);
  });

  it("flags missing successDefinition", () => {
    const project: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, successDefinition: "" },
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("success definition"))).toBe(true);
  });

  it("flags missing implementationDeadline", () => {
    const project: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, implementationDeadline: "" },
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("deadline"))).toBe(true);
  });
});

describe("detectMissingInfo — stakeholders", () => {
  it("flags missing stakeholders altogether", () => {
    const project: OnboardingProject = { ...fintech, stakeholders: [] };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.includes("No stakeholders"))).toBe(true);
  });

  it("flags missing technical owner when stakeholders exist but none is technical_owner", () => {
    const project: OnboardingProject = {
      ...fintech,
      stakeholders: fintech.stakeholders.filter((s) => s.involvement !== "technical_owner"),
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("technical owner"))).toBe(true);
  });

  it("flags missing executive sponsor when stakeholders exist but none is sponsor", () => {
    const project: OnboardingProject = {
      ...fintech,
      stakeholders: fintech.stakeholders.filter((s) => s.involvement !== "sponsor"),
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("sponsor"))).toBe(true);
  });
});

describe("detectMissingInfo — systems & data", () => {
  it("flags unknown accessMethod on a system", () => {
    const project: OnboardingProject = {
      ...fintech,
      systems: [{ ...fintech.systems[0], accessMethod: "unknown", name: "SystemX" }],
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.includes("SystemX") && i.item.toLowerCase().includes("access method"))).toBe(true);
  });

  it("flags unknown apiAvailable on a system", () => {
    const project: OnboardingProject = {
      ...fintech,
      systems: [{ ...fintech.systems[0], apiAvailable: "unknown", name: "MysteryAPI" }],
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.includes("MysteryAPI") && i.item.toLowerCase().includes("api availability"))).toBe(true);
  });

  it("flags blocked data source access", () => {
    const project: OnboardingProject = {
      ...fintech,
      dataSources: [{ ...fintech.dataSources[0], accessStatus: "blocked", name: "BlockedDB" }],
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.includes("BlockedDB") && i.item.toLowerCase().includes("blocked"))).toBe(true);
  });

  it("flags unknown PII classification on a data source", () => {
    const project: OnboardingProject = {
      ...fintech,
      dataSources: [{ ...fintech.dataSources[0], pii: "unknown", name: "UnknownPII" }],
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.includes("UnknownPII") && i.item.toLowerCase().includes("pii"))).toBe(true);
  });

  it("surfaces open questions on a data source", () => {
    const project: OnboardingProject = {
      ...fintech,
      dataSources: [{
        ...fintech.dataSources[0],
        openQuestions: ["What is the retention policy?", "Who owns the dataset?"],
        name: "Investigated",
      }],
    };
    const items = detectMissingInfo(project);
    const openQ = items.find((i) => i.item.includes("Open questions") && i.item.includes("Investigated"));
    expect(openQ).toBeDefined();
    // First question is shown, "+1 more" suffix indicates remaining count
    expect(openQ?.item).toContain("retention policy");
    expect(openQ?.item).toContain("+1 more");
  });
});

describe("detectMissingInfo — workflow gaps", () => {
  it("flags workflow steps missing currentSystem", () => {
    const project: OnboardingProject = {
      ...fintech,
      workflows: [
        { ...fintech.workflows[0], currentSystem: "" },
        { ...fintech.workflows[1], currentSystem: "" },
      ],
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.includes("missing current system"))).toBe(true);
  });
});

describe("detectMissingInfo — pilot gaps", () => {
  it("flags missing pilot plan altogether", () => {
    const project: OnboardingProject = { ...fintech, pilotPlan: null };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("pilot plan not started"))).toBe(true);
  });

  it("flags missing success metrics in pilot", () => {
    if (!fintech.pilotPlan) return;
    const project: OnboardingProject = {
      ...fintech,
      pilotPlan: { ...fintech.pilotPlan, successMetrics: [] },
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("success metric"))).toBe(true);
  });

  it("flags missing launch criteria in pilot", () => {
    if (!fintech.pilotPlan) return;
    const project: OnboardingProject = {
      ...fintech,
      pilotPlan: { ...fintech.pilotPlan, launchCriteria: [] },
    };
    const items = detectMissingInfo(project);
    expect(items.some((i) => i.item.toLowerCase().includes("launch criteria"))).toBe(true);
  });
});

describe("detectMissingInfo — commercial / DPA", () => {
  it("flags missing DPA when regulatory context is present but constraints don't mention DPA", () => {
    const project: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, constraints: "no dpa here" },
    };
    // Wait — the check is constraints.toLowerCase().includes("dpa"). Use a string that doesn't include dpa
    const project2: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, constraints: "tight timeline" },
    };
    const items = detectMissingInfo(project2);
    expect(items.some((i) => i.item.toLowerCase().includes("dpa"))).toBe(true);
    // And verify: when constraints mentions DPA, the flag is suppressed
    const items1 = detectMissingInfo(project);
    expect(items1.some((i) => i.item.toLowerCase().includes("data processing agreement"))).toBe(false);
  });
});

describe("detectMissingInfo — output shape", () => {
  it("every item has id, item text, whyItMatters, owner, tab", () => {
    const items = detectMissingInfo(fintech);
    for (const i of items) {
      expect(i.id).toBeTruthy();
      expect(i.item).toBeTruthy();
      expect(i.whyItMatters).toBeTruthy();
      expect(i.suggestedOwner).toMatch(/^(customer|engineering|security|commercial|unknown)$/);
      expect(i.relatedTab).toMatch(/^(discovery|systems|workflow|pilot)$/);
    }
  });

  it("returns no duplicate ids", () => {
    const items = detectMissingInfo(fintech);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns a plausibly large set for a sparse project", () => {
    const sparse: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, currentProcess: "", successDefinition: "", implementationDeadline: "" },
      stakeholders: [],
      systems: [],
      dataSources: [],
      pilotPlan: null,
    };
    const items = detectMissingInfo(sparse);
    // Discovery×3, stakeholders×1, pilot×1, plus DPA if regulatory — at minimum 5
    expect(items.length).toBeGreaterThanOrEqual(5);
  });
});

describe("detectMissingInfo across all seeded scenarios", () => {
  it.each(scenarios.map((s) => [s.id, s] as [string, OnboardingProject]))(
    "produces a valid list for %s",
    (_id, scenario) => {
      const items = detectMissingInfo(scenario);
      // Output is an array — may be empty for fully-populated projects
      expect(Array.isArray(items)).toBe(true);
    }
  );
});
