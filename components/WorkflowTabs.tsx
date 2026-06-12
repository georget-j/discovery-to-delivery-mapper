"use client";

import {
  useState,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import { CanvasActivityProvider } from "@/components/visualisations/shared/CanvasActivityContext";
import { cn } from "@/lib/utils";

export type WorkflowTabId = "steps" | "current" | "future";

type TabStatus = { label: string; stale: boolean } | null;

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
export function WorkflowTabs({
  steps,
  current,
  future,
  defaultTab = "steps",
  active,
  onChange,
}: Props) {
  const [internal, setInternal] = useState<WorkflowTabId>(defaultTab);
  const activeTab = active ?? internal;
  const { requestMapSync } = useWorkspace();

  const setActive = (t: WorkflowTabId) => {
    if (active === undefined) setInternal(t);
    onChange?.(t);
  };

  const status = useTabStatuses();

  const syncFromStaleBadge = (variant: "current" | "future") => {
    setActive(variant);
    // Defer one tick so the panel becomes visible before the canvas regenerates.
    setTimeout(() => requestMapSync(variant), 50);
  };

  return (
    <div>
      <div role="tablist" className="flex items-center gap-1 border-b mb-3">
        <TabButton
          active={activeTab === "steps"}
          onClick={() => setActive("steps")}
          label="Steps"
          status={status.steps}
        />
        <span
          className="text-[10px] text-muted-foreground/60 italic mr-2"
          title="Step list is the source of truth — the two visualisations are derived from it"
        >
          ← source of truth
        </span>
        <TabButton
          active={activeTab === "current"}
          onClick={() => setActive("current")}
          label="Visualise current"
          status={status.current}
          onSync={() => syncFromStaleBadge("current")}
        />
        <TabButton
          active={activeTab === "future"}
          onClick={() => setActive("future")}
          label="Visualise future"
          status={status.future}
          onSync={() => syncFromStaleBadge("future")}
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
  active,
  onClick,
  label,
  status,
  onSync,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  status: TabStatus;
  onSync?: () => void;
}) {
  const handleStaleClick = (e: MouseEvent<HTMLSpanElement>) => {
    if (!onSync) return;
    e.stopPropagation();
    onSync();
  };
  const handleStaleKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!onSync) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onSync();
    }
  };
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
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}
    >
      <span>{label}</span>
      {status &&
        (status.stale && onSync ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleStaleClick}
            onKeyDown={handleStaleKey}
            title="Workflow steps changed since this map was generated — click to sync now"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer"
          >
            <span aria-hidden>↻</span>
            Sync
          </span>
        ) : (
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
              active
                ? "bg-muted text-muted-foreground"
                : "bg-muted/60 text-muted-foreground/80",
            )}
          >
            {status.label}
          </span>
        ))}
    </button>
  );
}

function TabPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  // Keep mounted; use hidden so canvases retain state across switches. The
  // activity provider lets hidden canvases disable their window-level
  // shortcut listeners (see useCanvasShortcuts).
  return (
    <div role="tabpanel" hidden={!active} className={active ? "" : "hidden"}>
      <CanvasActivityProvider active={active}>
        {children}
      </CanvasActivityProvider>
    </div>
  );
}

// Compute label statuses from the project so users see at-a-glance which tabs
// have content and whether maps are stale.
function useTabStatuses(): {
  steps: TabStatus;
  current: TabStatus;
  future: TabStatus;
} {
  const { project } = useWorkspace();
  if (!project) return { steps: null, current: null, future: null };

  const stepsCount = project.workflows.length;
  const stepsLabel = stepsCount > 0 ? `${stepsCount}` : "Empty";

  const currentMap = project.visualisations?.currentStateWorkflowMap;
  const futureMap = project.visualisations?.futureStateAIWorkflowMap;
  const currentHash = hashWorkflows(project.workflows);

  const mapStatus = (
    map: { derivedFromHash?: string } | undefined,
  ): TabStatus => {
    if (!map) return { label: "Empty", stale: false };
    if (map.derivedFromHash && map.derivedFromHash !== currentHash) {
      return { label: "Stale", stale: true };
    }
    return { label: "Ready", stale: false };
  };

  return {
    steps: { label: stepsLabel, stale: false },
    current: mapStatus(currentMap),
    future: mapStatus(futureMap),
  };
}
