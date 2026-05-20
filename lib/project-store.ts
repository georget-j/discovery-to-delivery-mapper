"use client";

import type { OnboardingProject } from "@/lib/types";

const KEY = (id: string) => `onboarding_project_${id}`;

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
}
