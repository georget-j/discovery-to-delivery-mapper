"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkflowStepEditor } from "@/components/WorkflowStepEditor";
import { WorkflowAtAGlance } from "@/components/WorkflowAtAGlance";
import { WorkflowTabs, type WorkflowTabId } from "@/components/WorkflowTabs";
import { CurrentStateWorkflowMap } from "@/components/visualisations/current-state-workflow/CurrentStateWorkflowMap";
import { FutureStateAIWorkflowMap } from "@/components/visualisations/future-state-workflow/FutureStateAIWorkflowMap";
import { FutureStateRecommendations } from "@/components/recommendations/FutureStateRecommendations";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { Surface } from "@/components/ui/surface";
import { SuggestionsBanner } from "@/components/SuggestionsBanner";
import { GenerateFromDiscoveryButton } from "@/components/GenerateFromDiscoveryButton";

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
        <div className="flex items-center gap-3 shrink-0 mt-1">
          {/* Persistent path to AI drafting; the empty state shows its own. */}
          {project.workflows.length > 0 && (
            <GenerateFromDiscoveryButton
              target="workflows"
              label="✨ Draft suggestions"
            />
          )}
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <SuggestionsBanner target="workflows" />

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
        future={
          <div className="space-y-4">
            <FutureStateAIWorkflowMap />
            {/* Step-level modernisation ideas live behind a disclosure so the
                in-canvas Suggestions rail is the primary surface. */}
            <details className="group rounded-md border bg-muted/10">
              <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span
                  aria-hidden
                  className="group-open:rotate-90 transition-transform"
                >
                  ▸
                </span>
                <span className="font-medium">
                  Step modernisation ideas (per workflow step)
                </span>
              </summary>
              <div className="px-4 pb-4 pt-1">
                <FutureStateRecommendations />
              </div>
            </details>
          </div>
        }
      />

      <PageNav />
    </div>
  );
}
