import { describe, it, expect } from "vitest";
import {
  PHASES,
  ALL_TABS,
  getPhaseForPath,
  getTabForPath,
  getPrevNext,
  isPhaseComplete,
  phaseProgress,
} from "../lib/journey";
import { listScenarios } from "../lib/scenarios";
import type { OnboardingProject } from "../lib/types";

const fintech = listScenarios().find((s) => s.id === "fintech-aml")!;
const PID = fintech.id;

// ── PHASES sanity ──────────────────────────────────────────────────────────

describe("PHASES", () => {
  it("has exactly 4 phases", () => {
    expect(PHASES).toHaveLength(4);
  });

  it("phases are numbered 1..4 in order", () => {
    expect(PHASES.map((p) => p.number)).toEqual([1, 2, 3, 4]);
  });

  it("phase ids are unique", () => {
    const ids = PHASES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every phase has at least one tab", () => {
    for (const p of PHASES) expect(p.tabs.length).toBeGreaterThan(0);
  });

  it("ALL_TABS flattens every phase tab in order", () => {
    const expected = PHASES.flatMap((p) => p.tabs.map((t) => t.href));
    const actual = ALL_TABS.map((x) => x.tab.href);
    expect(actual).toEqual(expected);
  });

  it("all tab hrefs are unique", () => {
    const hrefs = ALL_TABS.map((x) => x.tab.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

// ── getPhaseForPath ────────────────────────────────────────────────────────

describe("getPhaseForPath", () => {
  it("resolves root path to discover", () => {
    expect(getPhaseForPath(`/workspace/${PID}`, PID).id).toBe("discover");
  });

  it("resolves /discovery to discover", () => {
    expect(getPhaseForPath(`/workspace/${PID}/discovery`, PID).id).toBe(
      "discover",
    );
  });

  it("resolves /workflow to design", () => {
    expect(getPhaseForPath(`/workspace/${PID}/workflow`, PID).id).toBe(
      "design",
    );
  });

  it("resolves /systems to design", () => {
    expect(getPhaseForPath(`/workspace/${PID}/systems`, PID).id).toBe("design");
  });

  it("resolves /requirements to design", () => {
    expect(getPhaseForPath(`/workspace/${PID}/requirements`, PID).id).toBe(
      "design",
    );
  });

  it("resolves /risks to plan", () => {
    expect(getPhaseForPath(`/workspace/${PID}/risks`, PID).id).toBe("plan");
  });

  it("resolves /pilot to plan", () => {
    expect(getPhaseForPath(`/workspace/${PID}/pilot`, PID).id).toBe("plan");
  });

  it("resolves /outputs to deliver", () => {
    expect(getPhaseForPath(`/workspace/${PID}/outputs`, PID).id).toBe(
      "deliver",
    );
  });

  it("falls back to first phase for an unknown subpath", () => {
    expect(getPhaseForPath(`/workspace/${PID}/garbage`, PID).id).toBe(
      "discover",
    );
  });
});

// ── getTabForPath ──────────────────────────────────────────────────────────

describe("getTabForPath", () => {
  it("resolves /workflow to Workflows", () => {
    expect(getTabForPath(`/workspace/${PID}/workflow`, PID).label).toBe(
      "Workflows",
    );
  });

  it("resolves the root path to Overview", () => {
    expect(getTabForPath(`/workspace/${PID}`, PID).label).toBe("Overview");
  });

  it("falls back to first tab for an unknown subpath", () => {
    expect(getTabForPath(`/workspace/${PID}/nonsense`, PID).label).toBe(
      "Intake",
    );
  });
});

// ── getPrevNext ────────────────────────────────────────────────────────────

describe("getPrevNext", () => {
  it("first tab (Intake) has no prev", () => {
    const { prev, next } = getPrevNext(`/workspace/${PID}/intake`, PID);
    expect(prev).toBeNull();
    expect(next?.tab.label).toBe("Overview");
  });

  it("Overview tab sits between Intake and Discovery", () => {
    const { prev, next } = getPrevNext(`/workspace/${PID}`, PID);
    expect(prev?.tab.label).toBe("Intake");
    expect(next?.tab.label).toBe("Discovery");
  });

  it("last tab (Outputs) has no next", () => {
    const { prev, next } = getPrevNext(`/workspace/${PID}/outputs`, PID);
    expect(next).toBeNull();
    expect(prev?.tab.label).toBe("Pilot Plan");
  });

  it("middle tab has both prev and next", () => {
    const { prev, next } = getPrevNext(`/workspace/${PID}/workflow`, PID);
    expect(prev?.tab.label).toBe("Discovery");
    expect(next?.tab.label).toBe("Systems & Data");
  });

  it("crossing a phase boundary still resolves prev/next correctly", () => {
    const { prev, next } = getPrevNext(`/workspace/${PID}/risks`, PID);
    // Risks is first tab in 'plan'; previous tab is Requirements (last in 'design')
    expect(prev?.tab.label).toBe("Requirements");
    expect(next?.tab.label).toBe("Pilot Plan");
  });

  it("returns null/null for a completely unknown path", () => {
    const { prev, next } = getPrevNext(`/workspace/${PID}/who-knows`, PID);
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });
});

// ── isPhaseComplete ────────────────────────────────────────────────────────

describe("isPhaseComplete", () => {
  it("returns false for null project on every phase", () => {
    for (const p of PHASES) {
      expect(isPhaseComplete(null, p.id)).toBe(false);
    }
  });

  it("discover is complete when currentProcess + stakeholders exist", () => {
    expect(isPhaseComplete(fintech, "discover")).toBe(true);
  });

  it("discover is incomplete without currentProcess", () => {
    const project: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, currentProcess: "" },
    };
    expect(isPhaseComplete(project, "discover")).toBe(false);
  });

  it("design is incomplete without requirements", () => {
    const project: OnboardingProject = { ...fintech, requirements: [] };
    expect(isPhaseComplete(project, "design")).toBe(false);
  });

  it("plan is incomplete without pilot objective", () => {
    if (!fintech.pilotPlan) return;
    const project: OnboardingProject = {
      ...fintech,
      pilotPlan: { ...fintech.pilotPlan, objective: "" },
    };
    expect(isPhaseComplete(project, "plan")).toBe(false);
  });

  it("deliver is incomplete without outputs.executiveSummary", () => {
    const project: OnboardingProject = { ...fintech, outputs: null };
    expect(isPhaseComplete(project, "deliver")).toBe(false);
  });
});

// ── phaseProgress ──────────────────────────────────────────────────────────

describe("phaseProgress", () => {
  it("returns 0/1 for null project", () => {
    const result = phaseProgress(null, "discover");
    expect(result.done).toBe(0);
    expect(result.total).toBe(1);
    expect(result.checks).toHaveLength(1);
  });

  it("counts both discover checks when complete", () => {
    const result = phaseProgress(fintech, "discover");
    expect(result.done).toBe(2);
    expect(result.total).toBe(2);
    expect(result.checks.every((c) => c.done)).toBe(true);
  });

  it("counts partial discover progress", () => {
    const project: OnboardingProject = {
      ...fintech,
      discovery: { ...fintech.discovery, currentProcess: "" },
    };
    const result = phaseProgress(project, "discover");
    expect(result.done).toBe(1);
    expect(result.total).toBe(2);
  });

  it("counts design as 3-check ratio", () => {
    const result = phaseProgress(fintech, "design");
    expect(result.total).toBe(3);
    expect(result.done).toBeGreaterThanOrEqual(0);
    expect(result.done).toBeLessThanOrEqual(3);
  });

  it("deliver is 0/1 when no outputs", () => {
    const project: OnboardingProject = { ...fintech, outputs: null };
    const result = phaseProgress(project, "deliver");
    expect(result.done).toBe(0);
    expect(result.total).toBe(1);
  });

  it("returns labelled checks", () => {
    const result = phaseProgress(fintech, "design");
    expect(result.checks.map((c) => c.label)).toEqual([
      "Workflow steps captured",
      "Systems documented",
      "Requirements captured",
    ]);
  });
});
