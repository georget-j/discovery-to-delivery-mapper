"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { SystemsDataSourceEditor } from "@/components/SystemsDataSourceEditor";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";
import { SuggestionsBanner } from "@/components/SuggestionsBanner";
import { GenerateFromDiscoveryButton } from "@/components/GenerateFromDiscoveryButton";

export default function SystemsPage() {
  const { project, loading, updateProject } = useWorkspace();
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
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Systems & Data</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every system and data source the AI will touch. Missing APIs,
            blocked access, and poor data quality are flagged as risks
            automatically.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-1">
          {/* Persistent path to AI drafting; the empty state shows its own. */}
          {project.systems.length > 0 && (
            <GenerateFromDiscoveryButton
              target="systems"
              label="✨ Draft suggestions"
            />
          )}
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <SuggestionsBanner target="systems" />

      <SystemsDataSourceEditor
        systems={project.systems}
        dataSources={project.dataSources}
        onSystemsChange={(systems) => updateProject({ systems })}
        onDataSourcesChange={(dataSources) => updateProject({ dataSources })}
      />

      <PageNav />
    </div>
  );
}
