"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { OnboardingProject } from "@/lib/types";
import { loadProject, saveProject } from "@/lib/project-store";
import { loadScenario } from "@/lib/scenarios";
import { usePhaseCompletionCelebration } from "./usePhaseCompletionCelebration";

export type WorkflowMapVariant = "current" | "future";

type WorkspaceContextValue = {
  project: OnboardingProject | null;
  loading: boolean;
  updateProject: (patch: Partial<OnboardingProject>) => void;
  /** Counter — increment to ask the matching canvas to regenerate. */
  syncRequests: Record<WorkflowMapVariant, number>;
  requestMapSync: (variant: WorkflowMapVariant) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  project: null,
  loading: true,
  updateProject: () => {},
  syncRequests: { current: 0, future: 0 },
  requestMapSync: () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<OnboardingProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncRequests, setSyncRequests] = useState<
    Record<WorkflowMapVariant, number>
  >({ current: 0, future: 0 });

  const requestMapSync = useCallback((variant: WorkflowMapVariant) => {
    setSyncRequests((prev) => ({ ...prev, [variant]: prev[variant] + 1 }));
  }, []);

  useEffect(() => {
    // Try localStorage first (with a one-time migration from the old
    // sessionStorage key), then fall back to seeded scenario.
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
      const updated = {
        ...prev,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      return updated;
    });
  }, []);

  // Fires a one-shot toast when a phase transitions to fully complete.
  usePhaseCompletionCelebration(project);

  return (
    <WorkspaceContext.Provider
      value={{
        project,
        loading,
        updateProject,
        syncRequests,
        requestMapSync,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
