"use client";

import { Legend } from "../shared/Legend";

export function WorkflowLegend() {
  return (
    <Legend
      items={[
        { label: "Human step", className: "bg-blue-100 border-blue-300" },
        { label: "System step", className: "bg-emerald-100 border-emerald-300" },
        { label: "Decision point", className: "bg-amber-100 border-amber-300" },
        { label: "Risk", className: "bg-red-100 border-red-300" },
        { label: "Missing info", className: "bg-orange-100 border-orange-300 border-dashed" },
        { label: "Exception path (dashed edge)", className: "bg-slate-100 border-slate-300" },
      ]}
    />
  );
}
