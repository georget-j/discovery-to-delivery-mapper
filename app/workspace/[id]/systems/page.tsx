"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { SystemsDataSourceEditor } from "@/components/SystemsDataSourceEditor";
import { PageNav } from "@/components/PageNav";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";

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
        <SaveIndicator state={saveState} className="shrink-0 mt-1" />
      </div>

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
