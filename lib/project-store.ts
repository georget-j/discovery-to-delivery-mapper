"use client";

import type { OnboardingProject } from "@/lib/types";
import { generateId } from "@/lib/utils";

const KEY = (id: string) => `onboarding_project_${id}`;
const LOCAL_IDS_KEY = "onboarding_local_project_ids";

export function saveProject(project: OnboardingProject): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    ...project,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY(project.id), payload);
}

export function loadProject(id: string): OnboardingProject | null {
  if (typeof window === "undefined") return null;
  const key = KEY(id);
  let raw = localStorage.getItem(key);
  if (!raw) {
    // One-time migration: projects saved in earlier builds lived in
    // sessionStorage and vanished when the user closed the tab. Copy any
    // surviving entry across so users don't lose in-flight work.
    const legacy = sessionStorage.getItem(key);
    if (legacy) {
      localStorage.setItem(key, legacy);
      sessionStorage.removeItem(key);
      raw = legacy;
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingProject;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  if (typeof window === "undefined") return;
  const key = KEY(id);
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  unregisterLocalProject(id);
}

// ── Blank project factory ─────────────────────────────────────────────────
// Mint an empty project shell that the user can fill in from the workspace.
// Distinct from the 4 seeded scenarios — these are user-created and tracked
// in their own localStorage registry so they remain discoverable across
// sessions.

export function createBlankProject(name?: string): OnboardingProject {
  const id = `local-${generateId()}`;
  const now = new Date().toISOString();
  return {
    id,
    name: name?.trim() || "Untitled Project",
    scenarioType: "custom",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    customer: {
      companyName: name?.trim() || "",
      industry: "other",
      companySize: "mid_market",
      primaryUseCase: "",
      businessProblem: "",
      desiredOutcome: "",
      urgency: "medium",
      regulatoryContext: [],
      technicalMaturity: "medium",
    },
    discovery: {
      currentProcess: "",
      usersAffected: "",
      implementationDeadline: "",
      constraints: "",
      knownRisks: "",
      successDefinition: "",
      buyerTeam: "",
      riskLevel: "medium",
    },
    workflows: [],
    systems: [],
    dataSources: [],
    requirements: [],
    risks: [],
    stakeholders: [],
    pilotPlan: null,
    outputs: null,
    meetingSessions: [],
  };
}

// ── Local project registry ────────────────────────────────────────────────
// Tracks every user-created (non-seeded) project ID so the scenarios page
// and scenario-switcher can list them. The IDs are persisted as a JSON
// array under LOCAL_IDS_KEY.

function readLocalIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_IDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_IDS_KEY, JSON.stringify(ids));
}

export function registerLocalProject(id: string): void {
  const ids = readLocalIds();
  if (ids.includes(id)) return;
  ids.unshift(id);
  writeLocalIds(ids);
}

export function unregisterLocalProject(id: string): void {
  const ids = readLocalIds().filter((existing) => existing !== id);
  writeLocalIds(ids);
}

export function listLocalProjects(): OnboardingProject[] {
  const ids = readLocalIds();
  return ids
    .map((id) => loadProject(id))
    .filter((p): p is OnboardingProject => p !== null);
}
