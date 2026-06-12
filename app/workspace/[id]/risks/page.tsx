"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { RiskRegister } from "@/components/RiskRegister";
import { AddRiskForm } from "@/components/AddRiskForm";
import { generateRisks } from "@/lib/risk-engine";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { SuggestionsBanner } from "@/components/SuggestionsBanner";
import { GenerateFromDiscoveryButton } from "@/components/GenerateFromDiscoveryButton";
import { toast } from "@/lib/toast";
import type { DeploymentRisk, RiskStatus } from "@/lib/types";

export default function RisksPage() {
  const { project, loading, updateProject } = useWorkspace();
  const [showForm, setShowForm] = useState(false);
  const saveState = useSaveIndicator(project?.updatedAt);

  // On first visit per project, merge generated risks into project.risks so
  // status changes persist across reloads.
  useEffect(() => {
    if (!project) return;
    const generated = generateRisks(project);
    const existingTitles = new Set(project.risks.map((r) => r.title));
    const newRisks = generated
      .filter((r) => !existingTitles.has(r.title))
      .map((r) => ({ ...r, source: "auto" as const }));
    if (newRisks.length > 0) {
      updateProject({ risks: [...project.risks, ...newRisks] });
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  const handleAddRisk = (risk: DeploymentRisk) => {
    updateProject({ risks: [...project.risks, risk] });
    setShowForm(false);
  };

  const handleStatusChange = (id: string, status: RiskStatus) => {
    updateProject({
      risks: project.risks.map((r) => (r.id === id ? { ...r, status } : r)),
    });
  };

  const handleDeleteRisk = (id: string) => {
    updateProject({ risks: project.risks.filter((r) => r.id !== id) });
  };

  const handleDetect = () => {
    const generated = generateRisks(project);
    const existingTitles = new Set(project.risks.map((r) => r.title));
    const fresh = generated
      .filter((r) => !existingTitles.has(r.title))
      .map((r) => ({ ...r, source: "auto" as const }));
    if (fresh.length === 0) {
      toast.info("No new risks detected", {
        description:
          "Add more systems, data sources, or stakeholders and try again.",
      });
      return;
    }
    updateProject({ risks: [...project.risks, ...fresh] });
    const critical = fresh.filter((r) => r.severity === "critical").length;
    toast.success(
      `Detected ${fresh.length} risk${fresh.length !== 1 ? "s" : ""}` +
        (critical > 0 ? ` · ${critical} critical` : ""),
    );
  };

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Risk Register</h1>
          <p className="text-muted-foreground text-sm mt-1">
            What could derail the deployment, with severity × likelihood and a
            mitigation. Auto-generated from your inputs; add custom ones below.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SaveIndicator state={saveState} />
          {/* Persistent path to AI drafting; the empty state shows its own. */}
          {project.risks.length > 0 && (
            <GenerateFromDiscoveryButton
              target="risks"
              label="✨ Draft suggestions"
            />
          )}
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
            >
              + Add Risk
            </button>
          )}
        </div>
      </div>

      <SuggestionsBanner target="risks" />

      {showForm && (
        <AddRiskForm
          onSave={handleAddRisk}
          onCancel={() => setShowForm(false)}
        />
      )}

      <RiskRegister
        risks={project.risks}
        onStatusChange={handleStatusChange}
        onDelete={handleDeleteRisk}
        onDetect={handleDetect}
      />

      <PageNav />
    </div>
  );
}
