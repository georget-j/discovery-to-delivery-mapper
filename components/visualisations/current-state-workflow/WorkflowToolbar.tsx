"use client";

import { useState } from "react";
import type { WorkflowNodeType } from "@/lib/visualisations/workflow-types";
import { cn } from "@/lib/utils";

type Props = {
  generating: boolean;
  hasMap: boolean;
  onGenerate: () => void;
  onAddNode: (type: WorkflowNodeType) => void;
  onExportMermaid: () => void;
  onExportJson: () => void;
  onReset: () => void;
  source?: string;
};

const ADD_OPTIONS: { type: WorkflowNodeType; label: string }[] = [
  { type: "human_step", label: "+ Human step" },
  { type: "system_step", label: "+ System step" },
  { type: "decision", label: "+ Decision" },
  { type: "risk", label: "+ Risk" },
  { type: "missing_info", label: "+ Missing info" },
];

export function WorkflowToolbar({ generating, hasMap, onGenerate, onAddNode, onExportMermaid, onExportJson, onReset, source }: Props) {
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
        {generating ? "Generating…" : hasMap ? "AI Improve" : "AI Generate"}
      </button>

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
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-md border bg-background shadow-md py-1">
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
