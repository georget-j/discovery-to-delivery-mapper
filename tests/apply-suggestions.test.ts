import { describe, it, expect } from "vitest";
import {
  applySuggestionsToProject,
  type SuggestionRowId,
} from "../lib/apply-suggestions";
import fintechScenario from "../data/scenarios/fintech-aml-onboarding.json";
import type { NotesExtractionResult, OnboardingProject } from "../lib/types";

const fintech = fintechScenario as unknown as OnboardingProject;

function pickAll(suggestions: NotesExtractionResult): Set<SuggestionRowId> {
  const picked = new Set<SuggestionRowId>();
  for (const key of Object.keys(suggestions.discovery ?? {}))
    picked.add(`discovery:${key}` as SuggestionRowId);
  (suggestions.suggestedStakeholders ?? []).forEach((_, i) =>
    picked.add(`stakeholder:${i}` as SuggestionRowId),
  );
  (suggestions.suggestedSystems ?? []).forEach((_, i) =>
    picked.add(`system:${i}` as SuggestionRowId),
  );
  (suggestions.suggestedDataSources ?? []).forEach((_, i) =>
    picked.add(`dataSource:${i}` as SuggestionRowId),
  );
  (suggestions.suggestedWorkflows ?? []).forEach((_, i) =>
    picked.add(`workflow:${i}` as SuggestionRowId),
  );
  (suggestions.suggestedRisks ?? []).forEach((_, i) =>
    picked.add(`risk:${i}` as SuggestionRowId),
  );
  return picked;
}

describe("applySuggestionsToProject — free-text caps", () => {
  it("clamps oversized single-line fields to 200 chars", () => {
    const suggestions: NotesExtractionResult = {
      suggestedStakeholders: [
        {
          name: "N".repeat(1000),
          role: "R".repeat(1000),
          team: "T".repeat(1000),
          concerns: [],
        },
      ],
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    const added = patch.stakeholders!.at(-1)!;
    expect(added.name).toBe("N".repeat(200));
    expect(added.role).toBe("R".repeat(200));
    expect(added.team).toBe("T".repeat(200));
  });

  it("clamps oversized long fields to 2000 chars", () => {
    const suggestions: NotesExtractionResult = {
      suggestedRisks: [
        {
          title: "Unique risk title xyz",
          description: "D".repeat(10000),
          category: "integration",
          severity: "high",
          likelihood: "medium",
          mitigation: "M".repeat(10000),
        },
      ],
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    const added = patch.risks!.at(-1)!;
    expect(added.description).toBe("D".repeat(2000));
    expect(added.mitigation).toBe("M".repeat(2000));
  });

  it("strips control chars (incl. newlines) from single-line fields", () => {
    const suggestions: NotesExtractionResult = {
      suggestedSystems: [
        {
          name: "Sys\x00tem\nNew\x07line\x1b[31m",
          type: "crm",
          notes: "",
        },
      ],
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    expect(patch.systems!.at(-1)!.name).toBe("SystemNewline[31m");
  });

  it("strips control chars but keeps newlines in long fields", () => {
    const suggestions: NotesExtractionResult = {
      suggestedRisks: [
        {
          title: "Another unique risk",
          description: "line one\nline\x00 two\r\x07",
          category: "security",
          severity: "low",
          likelihood: "low",
          mitigation: "",
        },
      ],
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    expect(patch.risks!.at(-1)!.description).toBe("line one\nline two");
  });

  it("caps each suggestion category at 20 rows per apply", () => {
    const suggestions: NotesExtractionResult = {
      suggestedStakeholders: Array.from({ length: 30 }, (_, i) => ({
        name: `Brand New Person ${i}`,
        role: `Role ${i}`,
        team: `Team ${i}`,
        concerns: [],
      })),
      suggestedWorkflows: Array.from({ length: 30 }, (_, i) => ({
        name: `Brand new workflow ${i}`,
        description: "",
        ownerTeam: "Ops",
        frequency: "daily",
        manualEffort: "low",
        painPoints: [],
      })),
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    expect(patch.stakeholders!.length - fintech.stakeholders.length).toBe(20);
    expect(patch.workflows!.length - fintech.workflows.length).toBe(20);
  });

  it("caps nested concerns/painPoints entries", () => {
    const suggestions: NotesExtractionResult = {
      suggestedStakeholders: [
        {
          name: "Concerned Carol",
          role: "Analyst",
          team: "Risk",
          concerns: Array.from({ length: 30 }, (_, i) => `concern ${i}`),
        },
      ],
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    expect(patch.stakeholders!.at(-1)!.concerns.length).toBe(20);
  });

  it("clamps discovery and customer free-text fields", () => {
    const suggestions: NotesExtractionResult = {
      discovery: {
        businessProblem: "P".repeat(5000),
        currentProcess: "C".repeat(5000),
        buyerTeam: "B".repeat(1000),
      },
      summary: "",
    };
    const { patch } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    expect(patch.customer!.businessProblem).toBe("P".repeat(2000));
    expect(patch.discovery!.currentProcess).toBe("C".repeat(2000));
    expect(patch.discovery!.buyerTeam).toBe("B".repeat(200));
  });

  it("passes normal-size suggestions through unchanged", () => {
    const suggestions: NotesExtractionResult = {
      suggestedStakeholders: [
        {
          name: "Jane Doe",
          role: "Head of Compliance Ops",
          team: "Compliance",
          concerns: ["Audit trail completeness"],
        },
      ],
      suggestedRisks: [
        {
          title: "Sandbox access delayed",
          description: "IT has a 4-week lead time for vendor accounts.",
          category: "timeline",
          severity: "medium",
          likelihood: "high",
          mitigation: "Raise the request during week 1.",
        },
      ],
      summary: "",
    };
    const { patch, appliedLabels } = applySuggestionsToProject(
      fintech,
      suggestions,
      pickAll(suggestions),
    );
    const stakeholder = patch.stakeholders!.at(-1)!;
    expect(stakeholder.name).toBe("Jane Doe");
    expect(stakeholder.role).toBe("Head of Compliance Ops");
    expect(stakeholder.team).toBe("Compliance");
    expect(stakeholder.concerns).toEqual(["Audit trail completeness"]);
    const risk = patch.risks!.at(-1)!;
    expect(risk.title).toBe("Sandbox access delayed");
    expect(risk.description).toBe(
      "IT has a 4-week lead time for vendor accounts.",
    );
    expect(risk.mitigation).toBe("Raise the request during week 1.");
    expect(appliedLabels.length).toBeGreaterThan(0);
  });
});
