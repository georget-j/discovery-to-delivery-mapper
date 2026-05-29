"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { hasReadyKnowledgeBase } from "@/components/intake/useIntakeQueue";
import { retrieve, type Retrieved } from "@/lib/kb/retrieve";

// Global on/off toggle for inline KB hints, persisted so power users can
// silence them once. Read synchronously so the first render is correct.
const HINTS_PREF_KEY = "ux:kbHintsEnabled";

export function kbHintsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(HINTS_PREF_KEY) !== "false";
}

export function setKbHintsEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HINTS_PREF_KEY, on ? "true" : "false");
}

export type KbHint = {
  id: string;
  text: string;
  label: string;
  similarity: number;
};

// Debounced, cached retrieval for a single field. Returns matching KB chunks
// for the supplied query — but only when the project actually has a knowledge
// base AND the global toggle is on, so it's free on KB-less projects.
//
// `query` is typically the field's purpose plus whatever the user has typed,
// e.g. "current process: AML analysts triage alerts in Actimize".
export function useKbHints(query: string, opts?: { enabled?: boolean }) {
  const { project } = useWorkspace();
  const enabled =
    (opts?.enabled ?? true) &&
    hasReadyKnowledgeBase(project) &&
    kbHintsEnabled();

  const [hints, setHints] = useState<KbHint[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, KbHint[]>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectId = project?.id ?? "";

  const run = useCallback(
    (q: string) => {
      const key = q.trim().toLowerCase();
      if (!enabled || key.length < 4 || !projectId) {
        setHints([]);
        return;
      }
      const cached = cacheRef.current.get(key);
      if (cached) {
        setHints(cached);
        return;
      }
      setLoading(true);
      retrieve(projectId, q, 3)
        .then((results: Retrieved[]) => {
          const mapped: KbHint[] = results.map((r) => ({
            id: r.chunk.id,
            text: r.chunk.text,
            label: r.label,
            similarity: r.similarity,
          }));
          cacheRef.current.set(key, mapped);
          setHints(mapped);
        })
        .catch(() => setHints([]))
        .finally(() => setLoading(false));
    },
    [enabled, projectId],
  );

  // Debounce query changes ~500ms.
  useEffect(() => {
    if (!enabled) {
      setHints([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => run(query), 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, enabled, run]);

  return { hints, loading, enabled };
}
