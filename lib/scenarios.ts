import type { OnboardingProject, ScenarioType } from "@/lib/types";

import fintechAml from "@/data/scenarios/fintech-aml-onboarding.json";
import legaltechContract from "@/data/scenarios/legaltech-contract-review.json";
import hardwareOps from "@/data/scenarios/hardware-ops-monitoring.json";
import enterpriseSupport from "@/data/scenarios/enterprise-support-agent.json";

const SCENARIOS = [
  fintechAml,
  legaltechContract,
  hardwareOps,
  enterpriseSupport,
] as unknown as OnboardingProject[];

export function listScenarios(): OnboardingProject[] {
  return SCENARIOS;
}

export function loadScenario(id: string): OnboardingProject | null {
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export type ScenarioMeta = {
  complexity: "Low" | "Medium" | "High";
  color: string;
  /** Rough end-to-end walkthrough time at first read. */
  estimatedMinutes: number;
  /** Who learns the most from this scenario. */
  bestFor: string;
  /** How many AI surfaces the scenario exercises in the deployment pack. */
  aiSurfaces: number;
  /** Position in the scenarios grid — ascending, starter first. */
  sortOrder: number;
  /** Recommended first scenario — gets the "Start here" badge. */
  starter?: boolean;
};

export const SCENARIO_META: Record<ScenarioType, ScenarioMeta> = {
  fintech_aml: {
    complexity: "High",
    color: "bg-red-50 text-red-700 border-red-200",
    estimatedMinutes: 45,
    bestFor: "Regulated industries (FCA, SAR workflows)",
    aiSurfaces: 4,
    sortOrder: 3,
  },
  legaltech_contract: {
    complexity: "High",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    estimatedMinutes: 40,
    bestFor: "Document-heavy professional services",
    aiSurfaces: 3,
    sortOrder: 2,
  },
  hardware_ops: {
    complexity: "Medium",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    estimatedMinutes: 30,
    bestFor: "Field-ops + signal-driven workflows",
    aiSurfaces: 3,
    sortOrder: 1,
  },
  enterprise_support: {
    complexity: "Medium",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    estimatedMinutes: 25,
    bestFor: "First-time visitors — softest landing",
    aiSurfaces: 3,
    sortOrder: 0,
    starter: true,
  },
  custom: {
    complexity: "Low",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    estimatedMinutes: 15,
    bestFor: "Bringing your own data",
    aiSurfaces: 0,
    sortOrder: 4,
  },
};
