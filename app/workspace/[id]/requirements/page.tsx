"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { RequirementsMatrix } from "@/components/RequirementsMatrix";
import { MissingInfoLog } from "@/components/MissingInfoLog";
import { AddRequirementForm } from "@/components/AddRequirementForm";
import { Separator } from "@/components/ui/separator";
import { generateRequirements } from "@/lib/requirements-engine";
import { detectMissingInfo } from "@/lib/missing-info-engine";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { toast } from "@/lib/toast";
import type { Requirement } from "@/lib/types";

export default function RequirementsPage() {
  const { project, loading, updateProject } = useWorkspace();
  const [showForm, setShowForm] = useState(false);
  const saveState = useSaveIndicator(project?.updatedAt);

  const generatedRequirements = useMemo(
    () => (project ? generateRequirements(project) : []),
    [project],
  );

  // Merge: generated first, then manually added (dedup by title)
  const allRequirements = useMemo(() => {
    if (!project) return [];
    const manualTitles = new Set(project.requirements.map((r) => r.title));
    const newGenerated = generatedRequirements.filter(
      (r) => !manualTitles.has(r.title),
    );
    return [...newGenerated, ...project.requirements];
  }, [generatedRequirements, project]);

  const manualIds = useMemo(
    () => new Set(project?.requirements.map((r) => r.id) ?? []),
    [project],
  );

  const missingInfo = useMemo(
    () => (project ? detectMissingInfo(project) : []),
    [project],
  );

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  const handleAddRequirement = (req: Requirement) => {
    updateProject({ requirements: [...project.requirements, req] });
    setShowForm(false);
  };

  const handleDeleteRequirement = (id: string) => {
    updateProject({
      requirements: project.requirements.filter((r) => r.id !== id),
    });
  };

  const handleDetect = () => {
    // Auto-derived requirements are computed live from project state, but
    // users sometimes need a nudge that the engine ran at all. Surface the
    // count instead of silently relying on the merge in allRequirements.
    const fresh = generatedRequirements.filter(
      (r) => !project.requirements.some((m) => m.title === r.title),
    );
    if (fresh.length === 0) {
      toast.info("No requirements detected yet", {
        description:
          "Add workflows, systems, or regulatory context and try again.",
      });
      return;
    }
    toast.success(
      `Detected ${fresh.length} requirement${fresh.length !== 1 ? "s" : ""}`,
      {
        description:
          "These appear in the matrix below — each one carries an evidence trail.",
      },
    );
  };

  return (
    <div className="p-8 max-w-4xl space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Requirements Matrix</h1>
          <p className="text-muted-foreground text-sm mt-1">
            The sign-off list for engineering. Auto-derived from your workflows,
            systems, regulatory context, and PII data — every item carries an
            evidence trail.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SaveIndicator state={saveState} />
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
            >
              + Add Requirement
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <AddRequirementForm
          onSave={handleAddRequirement}
          onCancel={() => setShowForm(false)}
        />
      )}

      <RequirementsMatrix
        requirements={allRequirements}
        manualIds={manualIds}
        onDelete={handleDeleteRequirement}
        onDetect={handleDetect}
      />

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Missing Information Log</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Items that must be resolved before pilot launch, grouped by
            responsible party.
          </p>
        </div>
        <MissingInfoLog items={missingInfo} />
      </section>

      <PageNav />
    </div>
  );
}
