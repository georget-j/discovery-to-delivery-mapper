"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { FutureWorkflowNode as NodeData, FutureWorkflowNodeType } from "@/lib/visualisations/workflow-types";
import { AutomationLevelBadge } from "./AutomationLevelBadge";
import { GuardrailBadge } from "./GuardrailBadge";

const TYPE_STYLES: Record<FutureWorkflowNodeType, { container: string; label: string; typeLabel: string }> = {
  human_action:    { container: "border-blue-300 bg-blue-50/80",       label: "text-blue-900",    typeLabel: "Human" },
  ai_assist:       { container: "border-violet-300 bg-violet-50/80",   label: "text-violet-900",  typeLabel: "AI assist" },
  ai_agent:        { container: "border-violet-400 bg-violet-100/80",  label: "text-violet-900",  typeLabel: "AI agent" },
  system_action:   { container: "border-emerald-300 bg-emerald-50/80", label: "text-emerald-900", typeLabel: "System" },
  data_retrieval:  { container: "border-emerald-300 bg-emerald-50/80", label: "text-emerald-900", typeLabel: "Retrieval" },
  guardrail:       { container: "border-pink-300 bg-pink-50/80",       label: "text-pink-900",    typeLabel: "Guardrail" },
  decision_gate:   { container: "border-amber-300 bg-amber-50/80",     label: "text-amber-900",   typeLabel: "Decision" },
  approval:        { container: "border-blue-400 bg-blue-100/80",      label: "text-blue-900",    typeLabel: "Approval" },
  monitoring:      { container: "border-cyan-300 bg-cyan-50/80",       label: "text-cyan-900",    typeLabel: "Monitoring" },
  audit_log:       { container: "border-cyan-300 bg-cyan-50/80 border-dashed", label: "text-cyan-900", typeLabel: "Audit log" },
  exception_path:  { container: "border-red-300 bg-red-50/80",         label: "text-red-900",     typeLabel: "Exception" },
};

function FutureWorkflowNodeImpl({ data, selected }: NodeProps) {
  const node = data as unknown as NodeData;
  const style = TYPE_STYLES[node.type];
  const isAi = node.type === "ai_assist" || node.type === "ai_agent";

  if (node.type === "decision_gate") {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2" />
        <div
          className={cn(
            "w-32 h-32 border-2 rotate-45 flex items-center justify-center transition-shadow",
            style.container,
            selected && "shadow-lg ring-2 ring-amber-400"
          )}
        >
          <div className="-rotate-45 text-center px-2">
            <p className={cn("text-[10px] uppercase tracking-wider font-medium opacity-60", style.label)}>Decision</p>
            <p className={cn("text-xs font-medium leading-tight mt-0.5", style.label)}>{node.title}</p>
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
          "rounded-md border-2 px-3 py-2 min-w-[180px] max-w-[220px] shadow-sm transition-shadow",
          style.container,
          selected && "shadow-lg ring-2 ring-primary/40"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-[10px] uppercase tracking-wider font-medium opacity-60", style.label)}>
            {style.typeLabel}
          </p>
          {node.requiredHumanApproval && (
            <span className="text-[10px] text-amber-700">👤 approval</span>
          )}
        </div>
        <p className={cn("text-xs font-semibold leading-snug mt-0.5", style.label)}>{node.title}</p>
        {node.description && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">{node.description}</p>
        )}
        {isAi && node.automationLevel && (
          <div className="mt-1.5">
            <AutomationLevelBadge level={node.automationLevel} />
          </div>
        )}
        {node.guardrails && node.guardrails.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {node.guardrails.slice(0, 2).map((g, i) => (
              <GuardrailBadge key={i} label={g} />
            ))}
            {node.guardrails.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{node.guardrails.length - 2}</span>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}

export const FutureWorkflowNode = memo(FutureWorkflowNodeImpl);
