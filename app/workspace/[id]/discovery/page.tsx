"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { DiscoveryForm } from "@/components/DiscoveryForm";
import { DiscoveryInterview } from "@/components/DiscoveryInterview";
import { DiscoveryCompletenessStrip } from "@/components/DiscoveryCompletenessStrip";
import { PageNav } from "@/components/PageNav";
import { LiveArtifactPreview } from "@/components/LiveArtifactPreview";
import { SuggestionsBanner } from "@/components/SuggestionsBanner";
import { cn } from "@/lib/utils";

type ViewMode = "interview" | "form";

export default function DiscoveryPage() {
  const { project, loading, updateProject } = useWorkspace();
  // Default Interview when the project is blank (no company name); Form when
  // there's pre-filled data so seeded scenarios aren't disrupted.
  const [view, setView] = useState<ViewMode>(() =>
    project?.customer.companyName ? "form" : "interview",
  );

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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">Customer Discovery</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Who they are, what they're trying to fix, and what was said in
                the discovery call. Feeds every downstream artifact.
              </p>
            </div>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <div className="px-8 space-y-6 pb-8">
          <DiscoveryCompletenessStrip />
          <SuggestionsBanner target="stakeholders" />
          {view === "interview" ? (
            <DiscoveryInterview onComplete={() => setView("form")} />
          ) : (
            <DiscoveryForm project={project} onUpdate={updateProject} />
          )}
          <PageNav />
        </div>
      </div>
      <LiveArtifactPreview
        artifacts={["executiveSummary", "customerDiscoverySummary"]}
      />
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Discovery view mode"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-muted/20 shrink-0"
    >
      {(["interview", "form"] as const).map((mode) => {
        const active = view === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className={cn(
              "text-xs px-3 py-1.5 rounded transition-colors capitalize",
              active
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === "interview" ? "💬 Interview" : "📝 Form"}
          </button>
        );
      })}
    </div>
  );
}
