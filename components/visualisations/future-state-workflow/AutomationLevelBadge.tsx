"use client";

import { cn } from "@/lib/utils";
import type { AutomationLevel } from "@/lib/visualisations/workflow-types";

const CONFIG: Record<AutomationLevel, { label: string; className: string }> = {
  suggest_only:                { label: "Suggest",      className: "bg-slate-100 text-slate-700 border-slate-300" },
  draft_only:                  { label: "Draft",        className: "bg-blue-100 text-blue-800 border-blue-300" },
  human_approval_required:    { label: "Approval req'd", className: "bg-amber-100 text-amber-900 border-amber-300" },
  autonomous_with_guardrails: { label: "Autonomous",    className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

export function AutomationLevelBadge({ level }: { level: AutomationLevel }) {
  const c = CONFIG[level];
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", c.className)}>
      {c.label}
    </span>
  );
}
