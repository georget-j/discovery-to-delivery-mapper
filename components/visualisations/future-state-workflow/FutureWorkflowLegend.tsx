"use client";

import { Legend } from "../shared/Legend";

export function FutureWorkflowLegend() {
  return (
    <Legend
      items={[
        { label: "Human",        className: "bg-blue-100 border-blue-300" },
        { label: "AI",           className: "bg-violet-100 border-violet-300" },
        { label: "System/Data",  className: "bg-emerald-100 border-emerald-300" },
        { label: "Guardrail",    className: "bg-pink-100 border-pink-300" },
        { label: "Decision",     className: "bg-amber-100 border-amber-300" },
        { label: "Monitoring",   className: "bg-cyan-100 border-cyan-300" },
        { label: "Escalation (dashed)", className: "bg-slate-100 border-slate-300" },
      ]}
    />
  );
}
