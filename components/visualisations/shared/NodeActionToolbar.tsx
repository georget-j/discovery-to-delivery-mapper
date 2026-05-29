"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

export type NodeAction = {
  key: string;
  label: string; // accessible label / tooltip
  icon: string; // short glyph or emoji
  onClick: () => void;
  emphasis?: boolean; // primary-tinted (e.g. ✨ Propose)
  danger?: boolean;
};

type Props = {
  visible: boolean;
  actions: NodeAction[];
};

// Floating action bar that sits above a node when it's hovered or selected.
// Built on React Flow's NodeToolbar so positioning tracks the node across
// pan/zoom. Rendered inside the custom node component.
export function NodeActionToolbar({ visible, actions }: Props) {
  if (actions.length === 0) return null;
  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={8}>
      <div className="flex items-center gap-0.5 rounded-md border bg-background shadow-md px-1 py-1">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={(e) => {
              e.stopPropagation();
              a.onClick();
            }}
            className={cn(
              "inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded text-xs transition-colors",
              a.emphasis
                ? "text-primary hover:bg-primary/10"
                : a.danger
                  ? "text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {a.icon}
          </button>
        ))}
      </div>
    </NodeToolbar>
  );
}
