"use client";

import { useEffect, useRef } from "react";
import type { OnboardingProject } from "@/lib/types";
import { PHASES, phaseProgress, type PhaseId } from "@/lib/journey";
import { toast } from "@/lib/toast";

// One-shot toast when a phase transitions from incomplete → complete.
// Persisted per (project, phase) in localStorage so reopening a project
// already finished doesn't fire again.
//
// Mount once at the top of the workspace tree. Watches the project on every
// state change; cheap to run (4 phaseProgress calls).
const NEXT_PHASE_BLURB: Record<PhaseId, string> = {
  discover: "Design phase unlocked — map the current workflow next.",
  design:   "Plan phase unlocked — surface risks and define the pilot.",
  plan:     "Deliver phase unlocked — generate the deployment pack.",
  deliver:  "Pack ready — copy or download whichever scope you need.",
};

const storageKey = (projectId: string, phaseId: PhaseId) => `ux:celebrated:${projectId}:${phaseId}`;

export function usePhaseCompletionCelebration(project: OnboardingProject | null) {
  // Previous "complete" set across renders so we can detect transitions.
  const prevComplete = useRef<Set<PhaseId>>(new Set());

  useEffect(() => {
    if (!project || typeof window === "undefined") return;

    const nowComplete = new Set<PhaseId>();
    for (const phase of PHASES) {
      const { done, total } = phaseProgress(project, phase.id);
      if (done === total) nowComplete.add(phase.id);
    }

    // First mount: seed from current state without firing toasts.
    if (prevComplete.current.size === 0 && nowComplete.size > 0) {
      // Treat any phases already complete on first observation as "already celebrated"
      // so reopening an existing project doesn't spam.
      for (const id of nowComplete) {
        try { localStorage.setItem(storageKey(project.id, id), "true"); } catch { /* ignore */ }
      }
      prevComplete.current = nowComplete;
      return;
    }

    // Find newly-complete phases that haven't been celebrated yet.
    for (const phase of PHASES) {
      const wasComplete = prevComplete.current.has(phase.id);
      const isComplete = nowComplete.has(phase.id);
      if (!wasComplete && isComplete) {
        const key = storageKey(project.id, phase.id);
        if (localStorage.getItem(key) === "true") continue;
        toast.success(`🎉 ${phase.label} complete!`, {
          description: NEXT_PHASE_BLURB[phase.id],
        });
        try { localStorage.setItem(key, "true"); } catch { /* ignore */ }
      }
    }

    prevComplete.current = nowComplete;
  }, [project]);
}
