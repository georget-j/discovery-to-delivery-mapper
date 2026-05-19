"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useMapEdit } from "../shared/MapEditContext";
import type { WorkflowNode as WorkflowNodeData, WorkflowNodeType } from "@/lib/visualisations/workflow-types";

const TYPE_STYLES: Record<WorkflowNodeType, { container: string; label: string }> = {
  human_step:   { container: "border-blue-300 bg-blue-50/80",       label: "text-blue-900" },
  system_step:  { container: "border-emerald-300 bg-emerald-50/80", label: "text-emerald-900" },
  decision:     { container: "border-amber-300 bg-amber-50/80",     label: "text-amber-900" },
  handoff:      { container: "border-violet-300 bg-violet-50/80",   label: "text-violet-900" },
  delay:        { container: "border-slate-300 bg-slate-50/80",     label: "text-slate-700" },
  risk:         { container: "border-red-300 bg-red-50/80",         label: "text-red-900" },
  missing_info: { container: "border-orange-300 bg-orange-50/80 border-dashed", label: "text-orange-900" },
  data_object:  { container: "border-cyan-300 bg-cyan-50/80",       label: "text-cyan-900" },
};

const TYPE_LABEL: Record<WorkflowNodeType, string> = {
  human_step: "Human",
  system_step: "System",
  decision: "Decision",
  handoff: "Handoff",
  delay: "Delay",
  risk: "Risk",
  missing_info: "Missing info",
  data_object: "Data",
};

function useInlineEdit(initial: string, onCommit: (v: string) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(initial); }, [initial]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const start = () => setEditing(true);
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== initial) onCommit(draft.trim());
  };
  const cancel = () => {
    setEditing(false);
    setDraft(initial);
  };

  return { editing, draft, setDraft, start, commit, cancel, inputRef };
}

function WorkflowNodeImpl({ id, data, selected }: NodeProps) {
  const node = data as unknown as WorkflowNodeData;
  const style = TYPE_STYLES[node.type];
  const { patchNode } = useMapEdit();

  const { editing, draft, setDraft, start, commit, cancel, inputRef } = useInlineEdit(
    node.title,
    (v) => patchNode(id, { title: v }),
  );

  if (node.type === "decision") {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2" />
        <div
          className={cn(
            "w-32 h-32 border-2 rotate-45 flex items-center justify-center transition-shadow",
            style.container,
            selected && "shadow-lg ring-2 ring-amber-400"
          )}
          onDoubleClick={(e) => { e.stopPropagation(); start(); }}
        >
          <div className="-rotate-45 text-center px-2 w-full">
            <p className={cn("text-[10px] uppercase tracking-wider font-medium opacity-60", style.label)}>Decision</p>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
                className={cn("w-full text-xs font-medium leading-tight mt-0.5 text-center bg-white/80 border border-amber-400 rounded px-1", style.label)}
              />
            ) : (
              <p className={cn("text-xs font-medium leading-tight mt-0.5", style.label)}>{node.title}</p>
            )}
          </div>
        </div>
        <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-amber-500 !w-2 !h-2" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
      <div
        className={cn(
          "rounded-md border-2 px-3 py-2 min-w-[160px] max-w-[200px] shadow-sm transition-shadow",
          style.container,
          selected && "shadow-lg ring-2 ring-primary/40"
        )}
        onDoubleClick={(e) => { e.stopPropagation(); start(); }}
      >
        <p className={cn("text-[10px] uppercase tracking-wider font-medium opacity-60", style.label)}>
          {TYPE_LABEL[node.type]}
        </p>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className={cn(
              "w-full text-xs font-semibold leading-snug mt-0.5 bg-white/80 border border-primary/40 rounded px-1 focus:outline-none focus:ring-1 focus:ring-primary",
              style.label,
            )}
          />
        ) : (
          <p className={cn("text-xs font-semibold leading-snug mt-0.5", style.label)}>{node.title}</p>
        )}
        {node.description && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">{node.description}</p>
        )}
        {node.owner && (
          <p className="text-[10px] text-muted-foreground mt-1.5 italic">{node.owner}</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeImpl);
