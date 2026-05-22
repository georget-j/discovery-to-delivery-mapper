"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import {
  deleteLibraryDoc,
  importLibraryDocToProject,
  listLibraryDocs,
  promoteToLibrary,
  type LibraryDoc,
} from "@/lib/kb/storage";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Cross-project KB library. Lets the user reuse uploaded docs across
// onboarding projects (e.g. a recurring vendor playbook, a regulatory
// guide). Library entries are independent of the source project — deleting
// the source project doesn't remove the library copy.
export function LibraryPanel() {
  const { project, updateProject } = useWorkspace();
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listLibraryDocs();
      setDocs(list);
    } catch {
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importToProject = async (libDoc: LibraryDoc) => {
    if (!project) return;
    setBusyId(libDoc.id);
    try {
      const projectDoc = await importLibraryDocToProject(libDoc, project.id);
      const existing = project.knowledgeBase ?? {
        docs: [],
        totalChunks: 0,
        totalTokensEmbedded: 0,
      };
      updateProject({
        knowledgeBase: {
          ...existing,
          docs: [...existing.docs, projectDoc],
          totalChunks: existing.totalChunks + projectDoc.chunkCount,
          lastIngestedAt: new Date().toISOString(),
        },
      });
      toast.success(`Imported ${libDoc.name}`);
    } catch (err) {
      toast.error("Library import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const promoteCurrentProjectDocs = async () => {
    if (!project?.knowledgeBase?.docs.length) {
      toast.info("No docs to promote yet");
      return;
    }
    const ready = project.knowledgeBase.docs.filter(
      (d) => d.status === "ready",
    );
    if (ready.length === 0) {
      toast.info("No ready docs to promote");
      return;
    }
    setBusyId("promote-all");
    try {
      for (const d of ready) {
        await promoteToLibrary(d);
      }
      toast.success(
        `Promoted ${ready.length} doc${ready.length !== 1 ? "s" : ""} to library`,
      );
      await refresh();
    } catch (err) {
      toast.error("Promotion failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (libDoc: LibraryDoc) => {
    setBusyId(libDoc.id);
    try {
      await deleteLibraryDoc(libDoc.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-md border bg-muted/5 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Shared library
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Reusable docs across projects. Library copies are independent of
            their source project.
          </p>
        </div>
        <button
          type="button"
          onClick={promoteCurrentProjectDocs}
          disabled={busyId !== null}
          className="text-xs px-2.5 py-1.5 rounded border hover:bg-muted/30"
        >
          {busyId === "promote-all"
            ? "Promoting…"
            : "Promote this project's docs →"}
        </button>
      </div>

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Library is empty. Promote a doc from any project to start.
        </p>
      ) : (
        <ul className="divide-y rounded border bg-background">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.type.toUpperCase()} · {d.chunkCount} chunk
                  {d.chunkCount !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => importToProject(d)}
                disabled={busyId !== null}
                className={cn(
                  "text-xs px-2 py-1 rounded border hover:bg-muted/40",
                  busyId === d.id && "opacity-60",
                )}
              >
                {busyId === d.id ? "Importing…" : "Add to project"}
              </button>
              <button
                type="button"
                onClick={() => remove(d)}
                disabled={busyId !== null}
                className="text-xs px-2 py-1 rounded hover:bg-muted/40 text-muted-foreground"
                title="Remove from library"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
