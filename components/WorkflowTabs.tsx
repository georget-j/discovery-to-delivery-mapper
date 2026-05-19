"use client";

import { useState, type ReactNode } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import { cn } from "@/lib/utils";

export type WorkflowTabId = "steps" | "current" | "future";

type Props = {
  steps: ReactNode;
  current: ReactNode;
  future: ReactNode;
  defaultTab?: WorkflowTabId;
  active?: WorkflowTabId;
  onChange?: (tab: WorkflowTabId) => void;
};

// Tabs preserve children mount state by using CSS visibility, not conditional
// render. This means the React Flow canvases keep their viewport, undo history,
// and selection across tab switches.
export function WorkflowTabs({ steps, current, future, defaultTab = "steps", active, onChange }: Props) {
  const [internal, setInternal] = useState<WorkflowTabId>(defaultTab);
  const activeTab = active ?? internal;

  const setActive = (t: WorkflowTabId) => {
    if (active === undefined) setInternal(t);
    onChange?.(t);
  };

  const status = useTabStatuses();

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b mb-3">
        <TabButton
          active={activeTab === "steps"}
          onClick={() => setActive("steps")}
          label="Steps"
          status={status.steps}
        />
        <TabButton
          active={activeTab === "current"}
          onClick={() => setActive("current")}
          label="Current-State Map"
          status={status.current}
        />
        <TabButton
          active={activeTab === "future"}
          onClick={() => setActive("future")}
          label="Future-State Map"
          status={status.future}
        />
      </div>

      <div className="relative">
        <TabPanel active={activeTab === "steps"}>{steps}</TabPanel>
        <TabPanel active={activeTab === "current"}>{current}</TabPanel>
        <TabPanel active={activeTab === "future"}>{future}</TabPanel>
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, label, status,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  status: string | null;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
        active
          ? "border-primary text-foreground bg-background"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      <span>{label}</span>
      {status && (
        <span className={cn(
          "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
          active ? "bg-muted text-muted-foreground" : "bg-muted/60 text-muted-foreground/80"
        )}>
          {status}
        </span>
      )}
    </button>
  );
}

function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  // Keep mounted; use hidden so canvases retain state across switches.
  return (
    <div role="tabpanel" hidden={!active} className={active ? "" : "hidden"}>
      {children}
    </div>
  );
}

// Compute label statuses from the project so users see at-a-glance which tabs
// have content and whether maps are stale.
function useTabStatuses(): { steps: string | null; current: string | null; future: string | null } {
  const { project } = useWorkspace();
  if (!project) return { steps: null, current: null, future: null };

  const stepsCount = project.workflows.length;
  const stepsLabel = stepsCount > 0 ? `${stepsCount}` : "Empty";

  const currentMap = project.visualisations?.currentStateWorkflowMap;
  const futureMap = project.visualisations?.futureStateAIWorkflowMap;
  const currentHash = hashWorkflows(project.workflows);

  const mapStatus = (
    map: { derivedFromHash?: string } | undefined,
  ): string | null => {
    if (!map) return "Empty";
    if (map.derivedFromHash && map.derivedFromHash !== currentHash) return "Stale";
    return "Ready";
  };

  return {
    steps: stepsLabel,
    current: mapStatus(currentMap),
    future: mapStatus(futureMap),
  };
}
