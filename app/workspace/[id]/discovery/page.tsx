"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { DiscoveryForm } from "@/components/DiscoveryForm";
import { DiscoveryCompletenessStrip } from "@/components/DiscoveryCompletenessStrip";
import { PageNav } from "@/components/PageNav";
import { LiveArtifactPreview } from "@/components/LiveArtifactPreview";

export default function DiscoveryPage() {
  const { project, loading, updateProject } = useWorkspace();

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  return (
    <div className="flex">
      <div className="flex-1 max-w-3xl space-y-6">
        <div className="sticky top-0 z-10 px-8 pt-8 pb-4 bg-background/95 backdrop-blur border-b">
          <h1 className="text-xl font-bold">Customer Discovery</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Who they are, what they're trying to fix, and what was said in the
            discovery call. Feeds every downstream artifact.
          </p>
        </div>
        <div className="px-8 space-y-6 pb-8">
          <DiscoveryCompletenessStrip />
          <DiscoveryForm project={project} onUpdate={updateProject} />
          <PageNav />
        </div>
      </div>
      <LiveArtifactPreview
        artifacts={["executiveSummary", "customerDiscoverySummary"]}
      />
    </div>
  );
}
