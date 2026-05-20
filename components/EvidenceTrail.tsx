"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import type { SourceRef } from "@/lib/types";
import { SOURCE_REF_COLORS, TAB_FOR_SOURCE_REF } from "@/lib/source-ref-colors";

type Props = {
  refs: SourceRef[] | undefined;
  className?: string;
};

export function EvidenceTrail({ refs, className }: Props) {
  const { project } = useWorkspace();
  if (!refs || refs.length === 0 || !project) return null;

  const projectId = project.id;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", className)}>
      <span className="text-muted-foreground">Evidence:</span>
      {refs.map((ref, i) => {
        const style = SOURCE_REF_COLORS[ref.type];
        const tab = TAB_FOR_SOURCE_REF[ref.type];
        const href = `/workspace/${projectId}${tab ? `/${tab}` : ""}`;
        return (
          <Link
            key={`${ref.type}-${ref.refId}-${i}`}
            href={href}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border hover:shadow-sm hover:translate-x-0.5 transition-all",
              style.chipClass,
            )}
            title={`${style.label} · click to view source`}
          >
            <span className="font-medium">{style.label}:</span>
            <span className="truncate max-w-[160px]">{ref.label ?? ref.refId}</span>
          </Link>
        );
      })}
    </div>
  );
}
