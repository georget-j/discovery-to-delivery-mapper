// Single source of truth for the 4-phase customer journey.
// Used by JourneyBar, WorkspaceSidebar, PageNav, and Overview.

import type { OnboardingProject } from "./types";
import { generateRequirements } from "./requirements-engine";

export type PhaseId = "discover" | "design" | "plan" | "deliver";

export type Tab = {
  href: string; // relative path under /workspace/[id]
  label: string;
  description: string;
};

export type Phase = {
  id: PhaseId;
  number: number;
  label: string;
  tagline: string;
  description: string;
  color: {
    text: string; // text-{color}-700
    bg: string; // bg-{color}-100
    bgSubtle: string; // bg-{color}-50
    border: string; // border-{color}-300
    ring: string; // ring-{color}-400
    accent: string; // bg-{color}-500 (for solid dots / steppers)
  };
  tabs: Tab[];
};

export const PHASES: Phase[] = [
  {
    id: "discover",
    number: 1,
    label: "Discover",
    tagline: "Understand the customer",
    description:
      "Capture customer context, business problem, stakeholders, and meeting notes.",
    color: {
      text: "text-blue-700",
      bg: "bg-blue-100",
      bgSubtle: "bg-blue-50",
      border: "border-blue-300",
      ring: "ring-blue-400",
      accent: "bg-blue-500",
    },
    tabs: [
      {
        href: "/intake",
        label: "Intake",
        description:
          "Drop customer docs and raw notes — the foundation for everything else",
      },
      {
        href: "",
        label: "Overview",
        description: "Project at a glance, open actions, and notes",
      },
      {
        href: "/discovery",
        label: "Discovery",
        description: "Customer profile, discovery call, and stakeholders",
      },
    ],
  },
  {
    id: "design",
    number: 2,
    label: "Design",
    tagline: "Map the solution",
    description:
      "Map current + future workflows, document systems and data, and capture requirements.",
    color: {
      text: "text-violet-700",
      bg: "bg-violet-100",
      bgSubtle: "bg-violet-50",
      border: "border-violet-300",
      ring: "ring-violet-400",
      accent: "bg-violet-500",
    },
    tabs: [
      {
        href: "/workflow",
        label: "Workflows",
        description: "Current-state + future-state workflow maps",
      },
      {
        href: "/systems",
        label: "Systems & Data",
        description: "Customer systems and data sources to integrate",
      },
      {
        href: "/requirements",
        label: "Requirements",
        description: "Functional, technical, and compliance requirements",
      },
    ],
  },
  {
    id: "plan",
    number: 3,
    label: "Plan",
    tagline: "De-risk and pilot",
    description:
      "Identify deployment risks and design a pilot with clear success metrics.",
    color: {
      text: "text-amber-700",
      bg: "bg-amber-100",
      bgSubtle: "bg-amber-50",
      border: "border-amber-300",
      ring: "ring-amber-400",
      accent: "bg-amber-500",
    },
    tabs: [
      {
        href: "/risks",
        label: "Risks",
        description:
          "Deployment risks with severity, likelihood, and mitigation",
      },
      {
        href: "/pilot",
        label: "Pilot Plan",
        description:
          "Pilot scope, users, metrics, and launch/rollback criteria",
      },
    ],
  },
  {
    id: "deliver",
    number: 4,
    label: "Deliver",
    tagline: "Ship the deployment pack",
    description:
      "Generate and export the client-facing deployment pack and engineering handoff.",
    color: {
      text: "text-emerald-700",
      bg: "bg-emerald-100",
      bgSubtle: "bg-emerald-50",
      border: "border-emerald-300",
      ring: "ring-emerald-400",
      accent: "bg-emerald-500",
    },
    tabs: [
      {
        href: "/outputs",
        label: "Outputs",
        description: "Generate the 15 onboarding artifacts and export the pack",
      },
    ],
  },
];

// Flat list of all tabs in order — used for prev/next navigation.
export const ALL_TABS: { tab: Tab; phase: Phase }[] = PHASES.flatMap((p) =>
  p.tabs.map((t) => ({ tab: t, phase: p })),
);

// Resolve the active phase from a pathname like "/workspace/abc/workflow".
// Nested routes (e.g. /outputs/matrix) resolve to the owning tab's phase via
// prefix match; the empty Overview href is exact-only so it can't swallow
// every path.
export function getPhaseForPath(pathname: string, projectId: string): Phase {
  const stripped = pathname.replace(`/workspace/${projectId}`, "") || "";
  for (const phase of PHASES) {
    if (
      phase.tabs.some(
        (t) =>
          t.href === stripped ||
          (t.href !== "" && stripped.startsWith(`${t.href}/`)),
      )
    )
      return phase;
  }
  return PHASES[0];
}

// Resolve the active tab from a pathname.
export function getTabForPath(pathname: string, projectId: string): Tab {
  const stripped = pathname.replace(`/workspace/${projectId}`, "") || "";
  for (const phase of PHASES) {
    for (const tab of phase.tabs) {
      if (tab.href === stripped) return tab;
    }
  }
  return PHASES[0].tabs[0];
}

// Prev/next navigation across the full journey.
export function getPrevNext(
  pathname: string,
  projectId: string,
): {
  prev: { tab: Tab; phase: Phase } | null;
  next: { tab: Tab; phase: Phase } | null;
} {
  const stripped = pathname.replace(`/workspace/${projectId}`, "") || "";
  const idx = ALL_TABS.findIndex(({ tab }) => tab.href === stripped);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? ALL_TABS[idx - 1] : null,
    next: idx < ALL_TABS.length - 1 ? ALL_TABS[idx + 1] : null,
  };
}

// ────────────────────────────────────────────────────────────
// Phase completion logic
// ────────────────────────────────────────────────────────────

// Manual requirements plus auto-derived ones (deduped by title, mirroring the
// Requirements tab merge). The requirements engine is deterministic from
// project state but its output is never persisted, so the Design phase must
// count it here — otherwise the phase can never complete for projects that
// rely on derived requirements alone.
export function requirementsCount(project: OnboardingProject): number {
  const manualTitles = new Set(project.requirements.map((r) => r.title));
  const derived = generateRequirements(project).filter(
    (r) => !manualTitles.has(r.title),
  );
  return project.requirements.length + derived.length;
}

export function isPhaseComplete(
  project: OnboardingProject | null,
  phaseId: PhaseId,
): boolean {
  if (!project) return false;
  switch (phaseId) {
    case "discover":
      return (
        !!project.discovery.currentProcess && project.stakeholders.length > 0
      );
    case "design":
      return (
        project.workflows.length > 0 &&
        project.systems.length > 0 &&
        requirementsCount(project) > 0
      );
    case "plan":
      return project.risks.length > 0 && !!project.pilotPlan?.objective;
    case "deliver":
      return !!project.outputs?.executiveSummary;
  }
}

export type PhaseCheck = { label: string; done: boolean };

export type PhaseProgress = {
  done: number;
  total: number;
  checks: PhaseCheck[];
};

export function phaseProgress(
  project: OnboardingProject | null,
  phaseId: PhaseId,
): PhaseProgress {
  if (!project)
    return {
      done: 0,
      total: 1,
      checks: [{ label: "Project loaded", done: false }],
    };
  const byPhase: Record<PhaseId, PhaseCheck[]> = {
    discover: [
      {
        label: "Current process documented",
        done: !!project.discovery.currentProcess,
      },
      {
        label: "Stakeholders identified",
        done: project.stakeholders.length > 0,
      },
    ],
    design: [
      { label: "Workflow steps captured", done: project.workflows.length > 0 },
      { label: "Systems documented", done: project.systems.length > 0 },
      { label: "Requirements captured", done: requirementsCount(project) > 0 },
    ],
    plan: [
      { label: "Risks identified", done: project.risks.length > 0 },
      { label: "Pilot objective set", done: !!project.pilotPlan?.objective },
    ],
    deliver: [
      {
        label: "Executive summary generated",
        done: !!project.outputs?.executiveSummary,
      },
    ],
  };
  const checks = byPhase[phaseId];
  return {
    done: checks.filter((c) => c.done).length,
    total: checks.length,
    checks,
  };
}
