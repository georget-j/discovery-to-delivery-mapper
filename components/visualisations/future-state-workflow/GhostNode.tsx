"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FutureWorkflowNode as NodeData } from "@/lib/visualisations/workflow-types";

// Translucent, non-interactive preview of a node a proposal would insert.
// Rendered on the canvas while the user hovers a proposal card, so they can
// see exactly what lands and where before committing.
function GhostNodeImpl({ data }: NodeProps) {
  const node = data as unknown as NodeData;
  return (
    <div className="relative pointer-events-none opacity-60">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="rounded-md border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-2 min-w-[170px] max-w-[220px]">
        <p className="text-[10px] uppercase tracking-wider font-medium text-primary/70">
          New · preview
        </p>
        <p className="text-xs font-semibold leading-snug mt-0.5 text-foreground/80">
          {node.title}
        </p>
        {node.description && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">
            {node.description}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

export const GhostNode = memo(GhostNodeImpl);
