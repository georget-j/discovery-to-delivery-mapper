"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkflowStepEditor } from "@/components/WorkflowStepEditor";
import { WorkflowAtAGlance } from "@/components/WorkflowAtAGlance";
import { WorkflowTabs, type WorkflowTabId } from "@/components/WorkflowTabs";
import { CurrentStateWorkflowMap } from "@/components/visualisations/current-state-workflow/CurrentStateWorkflowMap";
import { FutureStateAIWorkflowMap } from "@/components/visualisations/future-state-workflow/FutureStateAIWorkflowMap";
import { PageNav } from "@/components/PageNav";

export default function WorkflowPage() {
  const { project, loading, updateProject } = useWorkspace();
  const [activeTab, setActiveTab] = useState<WorkflowTabId>("steps");

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-sm text-muted-foreground">Project not found.</div>;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Workflow Mapping</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Steps are the source of truth. The two visual maps are derived views — generate or sync them once your steps are populated.
        </p>
      </div>

      <WorkflowAtAGlance
        steps={project.workflows}
        onJumpToStep={() => setActiveTab("steps")}
      />

      <WorkflowTabs
        active={activeTab}
        onChange={setActiveTab}
        steps={
          <div className="rounded-lg border bg-background p-4">
            <WorkflowStepEditor
              steps={project.workflows}
              onChange={(workflows) => updateProject({ workflows })}
            />
          </div>
        }
        current={<CurrentStateWorkflowMap />}
        future={<FutureStateAIWorkflowMap />}
      />

      <PageNav />
    </div>
  );
}
