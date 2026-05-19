"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { SystemsDataSourceEditor } from "@/components/SystemsDataSourceEditor";
import { PageNav } from "@/components/PageNav";

export default function SystemsPage() {
  const { project, loading, updateProject } = useWorkspace();

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-sm text-muted-foreground">Project not found.</div>;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Systems & Data</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Map the customer's existing systems and data sources. Integration blockers and data quality issues are flagged automatically.
        </p>
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
