"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkflowStepEditor } from "@/components/WorkflowStepEditor";
import { WorkflowAtAGlance } from "@/components/WorkflowAtAGlance";
import { WorkflowTabs, type WorkflowTabId } from "@/components/WorkflowTabs";
import { CurrentStateWorkflowMap } from "@/components/visualisations/current-state-workflow/CurrentStateWorkflowMap";
import { FutureStateAIWorkflowMap } from "@/components/visualisations/future-state-workflow/FutureStateAIWorkflowMap";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { Surface } from "@/components/ui/surface";

export default function WorkflowPage() {
  const { project, loading, updateProject } = useWorkspace();
  const [activeTab, setActiveTab] = useState<WorkflowTabId>("steps");
  const saveState = useSaveIndicator(project?.updatedAt);

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Workflow Mapping</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Steps are the source of truth. The two visual maps are derived views
            — generate or sync them once your steps are populated.
          </p>
        </div>
        <SaveIndicator state={saveState} className="shrink-0 mt-1" />
      </div>

      <WorkflowAtAGlance
        steps={project.workflows}
        onJumpToStep={() => setActiveTab("steps")}
      />

      <WorkflowTabs
        active={activeTab}
        onChange={setActiveTab}
        steps={
          <Surface className="p-4">
            <WorkflowStepEditor
              steps={project.workflows}
              onChange={(workflows) => updateProject({ workflows })}
            />
          </Surface>
        }
        current={<CurrentStateWorkflowMap />}
        future={<FutureStateAIWorkflowMap />}
      />

      <PageNav />
    </div>
  );
}
