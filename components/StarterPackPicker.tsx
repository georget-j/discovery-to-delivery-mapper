"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Modal } from "@/components/ui/modal";
import { Surface } from "@/components/ui/surface";
import { toast } from "@/lib/toast";
import { generateId } from "@/lib/utils";
import {
  STARTER_PACKS,
  packsForIndustry,
  type StarterPack,
} from "@/lib/starter-packs";
import type { CustomerSystem, WorkflowStep, Stakeholder } from "@/lib/types";

type Target = "systems" | "workflows" | "stakeholders" | "all";

type Props = {
  // Which surface to merge into. "all" injects systems + workflows +
  // stakeholders in one shot. Per-tab placement keeps the import scoped.
  target?: Target;
  // Optional label override. Defaults to "Add starter pack".
  label?: string;
  className?: string;
};

// Small pill-style button + modal flow that lets the user pick a pack
// matching their industry and merge it into the project.
export function StarterPackPicker({
  target = "all",
  label = "Add starter pack",
  className,
}: Props) {
  const { project, updateProject } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (!project) return null;

  const available = packsForIndustry(project.customer.industry);
  if (available.length === 0) return null;

  const apply = (pack: StarterPack) => {
    const patch: Partial<typeof project> = {};
    if (target === "systems" || target === "all") {
      const newSystems: CustomerSystem[] = pack.systems.map((s) => ({
        id: generateId(),
        name: s.name ?? "",
        type: s.type ?? "other",
        owner: s.owner ?? project.discovery.buyerTeam ?? "",
        accessMethod: s.accessMethod ?? "api",
        apiAvailable: s.apiAvailable ?? "unknown",
        authenticationMethod: s.authenticationMethod ?? "",
        dataSensitivity: s.dataSensitivity ?? "medium",
        integrationComplexity: s.integrationComplexity ?? "medium",
        notes: s.notes ?? "",
      }));
      patch.systems = [...project.systems, ...newSystems];
    }
    if (target === "workflows" || target === "all") {
      const newWorkflows: WorkflowStep[] = pack.workflows.map((w) => ({
        id: generateId(),
        name: w.name ?? "",
        description: w.description ?? "",
        ownerTeam: w.ownerTeam ?? project.discovery.buyerTeam ?? "",
        currentSystem: w.currentSystem ?? "",
        inputData: w.inputData ?? [],
        outputArtifact: w.outputArtifact ?? [],
        painPoints: w.painPoints ?? [],
        manualEffort: w.manualEffort ?? "medium",
        frequency: w.frequency ?? "daily",
        failureModes: w.failureModes ?? [],
        automationPotential: w.automationPotential ?? "medium",
        futureState: w.futureState ?? "ai_assisted",
      }));
      patch.workflows = [...project.workflows, ...newWorkflows];
    }
    if (target === "stakeholders" || target === "all") {
      const newStakeholders: Stakeholder[] = pack.stakeholders.map((s) => ({
        id: generateId(),
        name: s.name ?? "",
        role: s.role ?? "",
        team: s.team ?? project.discovery.buyerTeam ?? "",
        influence: s.influence ?? "medium",
        involvement: s.involvement ?? "end_user",
        concerns: s.concerns ?? [],
        requiredActions: s.requiredActions ?? [],
      }));
      patch.stakeholders = [...project.stakeholders, ...newStakeholders];
    }
    updateProject(patch);
    setOpen(false);
    const counts: string[] = [];
    if (patch.systems)
      counts.push(`${patch.systems.length - project.systems.length} systems`);
    if (patch.workflows)
      counts.push(
        `${patch.workflows.length - project.workflows.length} workflows`,
      );
    if (patch.stakeholders)
      counts.push(
        `${patch.stakeholders.length - project.stakeholders.length} stakeholders`,
      );
    toast.success(`Added ${pack.label}`, {
      description: counts.join(" · ") || "Pack applied",
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "text-xs px-3 py-1.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/30 transition-colors"
        }
      >
        📦 {label}
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Pick a starter pack"
        dismissOnBackdrop
        className="max-w-2xl"
      >
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">Starter packs</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pre-canned bundles matching your industry. Imported rows are fully
              editable.
            </p>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {available.map((pack) => {
              const counts: string[] = [];
              if (target === "systems" || target === "all")
                counts.push(`${pack.systems.length} systems`);
              if (target === "workflows" || target === "all")
                counts.push(`${pack.workflows.length} workflows`);
              if (target === "stakeholders" || target === "all")
                counts.push(`${pack.stakeholders.length} stakeholders`);
              return (
                <Surface
                  key={pack.id}
                  variant="interactive"
                  className="p-4 space-y-2"
                >
                  <button
                    type="button"
                    onClick={() => apply(pack)}
                    className="w-full text-left space-y-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-sm">{pack.label}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {counts.join(" · ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {pack.description}
                    </p>
                  </button>
                </Surface>
              );
            })}
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Force-imported in case tree-shaking strips an unreferenced symbol.
export { STARTER_PACKS };
