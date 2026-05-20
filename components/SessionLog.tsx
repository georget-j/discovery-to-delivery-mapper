"use client";

import { useState, useEffect, useMemo } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { SessionEditor } from "@/components/SessionEditor";
import { generateId } from "@/lib/utils";
import type { DiscoverySession } from "@/lib/types";

// Multi-session discovery log on the Overview. Replaces the single NotesImport
// textarea. Migrates legacy `meetingNotes` (a single string) into the first
// session on first open so existing scenarios + stored projects keep working.

export function SessionLog() {
  const { project, updateProject } = useWorkspace();
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const sessions = project?.meetingSessions ?? [];

  // One-time migration of legacy meetingNotes → first session.
  useEffect(() => {
    if (!project) return;
    const hasLegacy =
      !!project.meetingNotes && project.meetingNotes.trim().length > 0;
    const hasSessions = (project.meetingSessions?.length ?? 0) > 0;
    if (hasLegacy && !hasSessions) {
      const migrated: DiscoverySession = {
        id: generateId(),
        date: new Date(project.createdAt).toISOString().slice(0, 10),
        title: "Session 1 — initial notes",
        attendees: [],
        notes: project.meetingNotes!,
        actionItems: [],
        createdAt: project.createdAt,
      };
      updateProject({ meetingSessions: [migrated] });
    }
  }, [project, updateProject]);

  if (!project) return null;

  const sorted = useMemo(
    () =>
      [...sessions].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [sessions],
  );

  const updateSession = (next: DiscoverySession) => {
    updateProject({
      meetingSessions: sessions.map((s) => (s.id === next.id ? next : s)),
    });
  };

  const deleteSession = (id: string) => {
    updateProject({ meetingSessions: sessions.filter((s) => s.id !== id) });
  };

  const addSession = () => {
    const newSession: DiscoverySession = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      title: "",
      attendees: [],
      notes: "",
      actionItems: [],
      createdAt: new Date().toISOString(),
    };
    updateProject({ meetingSessions: [newSession, ...sessions] });
    setNewlyAddedId(newSession.id);
  };

  // Empty state
  if (sessions.length === 0) {
    return (
      <button
        type="button"
        onClick={addSession}
        className="w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all px-6 py-5 text-left group"
      >
        <div className="flex items-start gap-4">
          <span className="text-3xl shrink-0">📝</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Add your first discovery session
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Each session captures notes from one meeting or interview. AI
              extracts discovery fields, stakeholders, workflows, systems,
              risks, and action items — all attached to that session as
              evidence.
            </p>
          </div>
          <span className="text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
            →
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} · most
          recent first
        </p>
        <button
          type="button"
          onClick={addSession}
          className="text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted/50 transition-colors font-medium"
        >
          + Add session
        </button>
      </div>

      <div className="space-y-2">
        {sorted.map((s) => (
          <SessionEditor
            key={s.id}
            session={s}
            defaultOpen={s.id === newlyAddedId}
            onChange={updateSession}
            onDelete={() => deleteSession(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
