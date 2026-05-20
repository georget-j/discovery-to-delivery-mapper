"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { OnboardingProject } from "@/lib/types";
import { loadProject, saveProject } from "@/lib/project-store";
import { loadScenario } from "@/lib/scenarios";
import { usePhaseCompletionCelebration } from "./usePhaseCompletionCelebration";

type WorkspaceContextValue = {
  project: OnboardingProject | null;
  loading: boolean;
  updateProject: (patch: Partial<OnboardingProject>) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  project: null,
  loading: true,
  updateProject: () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const [project, setProject] = useState<OnboardingProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try sessionStorage first, then fall back to seeded scenario
    const stored = loadProject(id);
    if (stored) {
      setProject(stored);
    } else {
      const scenario = loadScenario(id);
      if (scenario) {
        saveProject(scenario);
        setProject(scenario);
      }
    }
    setLoading(false);
  }, [id]);

  const updateProject = useCallback((patch: Partial<OnboardingProject>) => {
    setProject((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveProject(updated);
      return updated;
    });
  }, []);

  // Fires a one-shot toast when a phase transitions to fully complete.
  usePhaseCompletionCelebration(project);

  return (
    <WorkspaceContext.Provider value={{ project, loading, updateProject }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
