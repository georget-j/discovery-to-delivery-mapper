"use client";

import { useState } from "react";
import type { FutureWorkflowNodeType } from "@/lib/visualisations/workflow-types";
import { cn } from "@/lib/utils";

type Props = {
  generating: boolean;
  hasMap: boolean;
  hasCurrentMap: boolean;
  comparing: boolean;
  source?: string;
  onGenerate: () => void;
  onToggleCompare: () => void;
  onAddNode: (type: FutureWorkflowNodeType) => void;
  onExportMermaid: () => void;
  onExportJson: () => void;
  onReset: () => void;
};

const ADD_OPTIONS: { type: FutureWorkflowNodeType; label: string }[] = [
  { type: "ai_assist", label: "+ AI assist" },
  { type: "ai_agent", label: "+ AI agent" },
  { type: "human_action", label: "+ Human action" },
  { type: "guardrail", label: "+ Guardrail" },
  { type: "decision_gate", label: "+ Decision gate" },
  { type: "monitoring", label: "+ Monitoring" },
  { type: "audit_log", label: "+ Audit log" },
];

export function FutureWorkflowToolbar({
  generating, hasMap, hasCurrentMap, comparing, source,
  onGenerate, onToggleCompare, onAddNode, onExportMermaid, onExportJson, onReset,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {source && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 rounded bg-muted/40">
          {source === "ai" ? "AI" : source === "manual" ? "Edited" : "Template"}
        </span>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className={cn(
          "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
          generating
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {generating ? "Generating…" : hasMap ? "AI Redesign" : "AI Generate"}
      </button>

      {hasMap && hasCurrentMap && (
        <button
          type="button"
          onClick={onToggleCompare}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md border transition-colors",
            comparing
              ? "bg-foreground text-background border-foreground"
              : "hover:bg-muted/50"
          )}
        >
          {comparing ? "Hide compare" : "Compare current"}
        </button>
      )}

      {hasMap && (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setAddOpen((v) => !v); setExportOpen(false); }}
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50 transition-colors"
          >
            Add node ▾
          </button>
          {addOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-md border bg-background shadow-md py-1">
              {ADD_OPTIONS.map((o) => (
                <button
                  key={o.type}
                  type="button"
                  onClick={() => { onAddNode(o.type); setAddOpen(false); }}
                  className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasMap && (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setExportOpen((v) => !v); setAddOpen(false); }}
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted/50 transition-colors"
          >
            Export ▾
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-md border bg-background shadow-md py-1">
              <button
                type="button"
                onClick={() => { onExportMermaid(); setExportOpen(false); }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                Download .mmd
              </button>
              <button
                type="button"
                onClick={() => { onExportJson(); setExportOpen(false); }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors"
              >
                Download .json
              </button>
            </div>
          )}
        </div>
      )}

      {hasMap && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
