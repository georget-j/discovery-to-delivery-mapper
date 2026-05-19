"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OnboardingProject, SourceRef, SourceRefType } from "@/lib/types";
import { computeArtifactSources, type ArtifactKey } from "@/lib/artifact-sources";

type Props = {
  project: OnboardingProject;
  artifactKey: ArtifactKey;
};

const TAB_FOR_TYPE: Record<SourceRefType, string> = {
  workflow_step:       "workflow",
  system:              "systems",
  data_source:         "systems",
  stakeholder:         "discovery",
  stakeholder_concern: "risks",
  discovery_field:     "discovery",
  session:             "",
  regulatory_context:  "discovery",
};

const DOT_FOR_TYPE: Record<SourceRefType, string> = {
  workflow_step:       "bg-blue-500",
  system:              "bg-emerald-500",
  data_source:         "bg-cyan-500",
  stakeholder:         "bg-purple-500",
  stakeholder_concern: "bg-red-500",
  discovery_field:     "bg-slate-500",
  session:             "bg-amber-500",
  regulatory_context:  "bg-red-500",
};

// Right-side panel on the Outputs page showing exactly which inputs fed the
// active artifact. Grouped by category. Click any ref to navigate to its source.
export function ArtifactSourcesPanel({ project, artifactKey }: Props) {
  const map = computeArtifactSources(project, artifactKey);
  const totalInputs = map.inputs.length;

  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Sources used
        </p>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
          {totalInputs === 0
            ? "No inputs captured yet for this artifact."
            : `${totalInputs} input${totalInputs !== 1 ? "s" : ""} drove this artifact. Click any to view.`}
        </p>
      </div>

      {totalInputs === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          Add data in the relevant tabs and regenerate. This artifact has no source inputs yet.
        </div>
      )}

      {map.sections.map((section) => (
        <div key={section.label} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}{" "}
            <span className="text-muted-foreground/50 font-normal normal-case">
              · {section.refs.length}
            </span>
          </p>
          <div className="space-y-1">
            {section.refs.map((ref, i) => (
              <SourceRow key={`${ref.type}-${ref.refId}-${i}`} ref_={ref} projectId={project.id} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceRow({ ref_, projectId }: { ref_: SourceRef; projectId: string }) {
  const tab = TAB_FOR_TYPE[ref_.type];
  const href = `/workspace/${projectId}${tab ? `/${tab}` : ""}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border bg-background hover:bg-muted/40 hover:shadow-sm transition-all"
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_FOR_TYPE[ref_.type])} />
      <span className="truncate">{ref_.label ?? ref_.refId}</span>
    </Link>
  );
}
