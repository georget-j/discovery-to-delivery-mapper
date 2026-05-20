"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import type { SourceRef, SourceRefType } from "@/lib/types";

type Props = {
  refs: SourceRef[] | undefined;
  className?: string;
};

// Maps a SourceRef type to the workspace tab where the source lives, so the
// chip is clickable and lands the user on the right page.
const TAB_FOR_TYPE: Record<SourceRefType, string> = {
  workflow_step:       "workflow",
  system:              "systems",
  data_source:         "systems",
  stakeholder:         "discovery",
  stakeholder_concern: "risks",       // concerns drive risk entries — route to Risks tab
  discovery_field:     "discovery",
  session:             "",            // Overview
  regulatory_context:  "discovery",
};

const STYLE_FOR_TYPE: Record<SourceRefType, { label: string; chipClass: string }> = {
  workflow_step:       { label: "Workflow step",  chipClass: "bg-blue-50 text-blue-800 border-blue-200" },
  system:              { label: "System",         chipClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  data_source:         { label: "Data source",    chipClass: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  stakeholder:         { label: "Stakeholder",    chipClass: "bg-purple-50 text-purple-800 border-purple-200" },
  stakeholder_concern: { label: "Concern",        chipClass: "bg-purple-50 text-purple-800 border-purple-200" },
  discovery_field:     { label: "Discovery",      chipClass: "bg-slate-50 text-slate-700 border-slate-200" },
  session:             { label: "Session",        chipClass: "bg-amber-50 text-amber-800 border-amber-200" },
  regulatory_context:  { label: "Regulation",     chipClass: "bg-red-50 text-red-800 border-red-200" },
};

export function EvidenceTrail({ refs, className }: Props) {
  const { project } = useWorkspace();
  if (!refs || refs.length === 0 || !project) return null;

  const projectId = project.id;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", className)}>
      <span className="text-muted-foreground">Evidence:</span>
      {refs.map((ref, i) => {
        const style = STYLE_FOR_TYPE[ref.type];
        const tab = TAB_FOR_TYPE[ref.type];
        const href = `/workspace/${projectId}${tab ? `/${tab}` : ""}`;
        return (
          <Link
            key={`${ref.type}-${ref.refId}-${i}`}
            href={href}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border hover:shadow-sm transition-shadow",
              style.chipClass,
            )}
            title={`${style.label} · click to view`}
          >
            <span className="font-medium">{style.label}:</span>
            <span className="truncate max-w-[160px]">{ref.label ?? ref.refId}</span>
          </Link>
        );
      })}
    </div>
  );
}
