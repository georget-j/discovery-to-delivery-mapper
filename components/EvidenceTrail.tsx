"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import type { SourceRef } from "@/lib/types";
import { SOURCE_REF_COLORS, TAB_FOR_SOURCE_REF } from "@/lib/source-ref-colors";

type Props = {
  refs: SourceRef[] | undefined;
  className?: string;
  /** Compact: omit the leading "Evidence:" label and shrink padding. Use on
   * collapsed list rows where space is tight. */
  compact?: boolean;
  /** Hard cap on visible chips; the rest collapse into a "+N" affordance. */
  max?: number;
};

// Anchor types — these get a `#refId` hash so callers can scroll-to-target on
// the destination tab.
const ANCHOR_TYPES: SourceRef["type"][] = [
  "system",
  "stakeholder",
  "data_source",
  "workflow_step",
];

export function EvidenceTrail({
  refs,
  className,
  compact = false,
  max,
}: Props) {
  const { project } = useWorkspace();
  if (!refs || refs.length === 0 || !project) return null;

  const projectId = project.id;
  const visible = max ? refs.slice(0, max) : refs;
  const hidden = max ? refs.length - visible.length : 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        compact ? "text-[10px]" : "text-[11px]",
        className,
      )}
    >
      {!compact && <span className="text-muted-foreground">Evidence:</span>}
      {visible.map((ref, i) => {
        const style = SOURCE_REF_COLORS[ref.type];
        const tab = TAB_FOR_SOURCE_REF[ref.type];
        const hash = ANCHOR_TYPES.includes(ref.type) ? `#${ref.refId}` : "";
        const href = `/workspace/${projectId}${tab ? `/${tab}` : ""}${hash}`;
        return (
          <Link
            key={`${ref.type}-${ref.refId}-${i}`}
            href={href}
            className={cn(
              "inline-flex items-center gap-1 rounded border hover:shadow-sm hover:translate-x-0.5 transition-all",
              compact ? "px-1 py-0" : "px-1.5 py-0.5",
              style.chipClass,
            )}
            title={`${style.label} · click to view source`}
          >
            {!compact && <span className="font-medium">{style.label}:</span>}
            <span className="truncate max-w-[160px]">
              {ref.label ?? ref.refId}
            </span>
          </Link>
        );
      })}
      {hidden > 0 && (
        <span className="text-muted-foreground/70">+{hidden}</span>
      )}
    </div>
  );
}
