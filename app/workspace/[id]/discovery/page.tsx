"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { DiscoveryForm } from "@/components/DiscoveryForm";
import { PageNav } from "@/components/PageNav";

export default function DiscoveryPage() {
  const { project, loading, updateProject } = useWorkspace();

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-sm text-muted-foreground">Project not found.</div>;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Customer Discovery</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Who they are, what they're trying to fix, and what was said in the discovery call. Feeds every downstream artifact.
        </p>
      </div>
      <DiscoveryForm project={project} onUpdate={updateProject} />
      <PageNav />
    </div>
  );
}
