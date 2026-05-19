"use client";

import type { CurrentStateWorkflowMap, FutureStateAIWorkflowMap } from "@/lib/visualisations/workflow-types";
import { diffWithCurrent } from "./futureWorkflowUtils";

type Props = {
  current: CurrentStateWorkflowMap | undefined;
  future: FutureStateAIWorkflowMap;
};

export function CurrentFutureComparisonPanel({ current, future }: Props) {
  const stats = diffWithCurrent(current, future);

  return (
    <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current ↔ Future Comparison</p>
        {!current && (
          <p className="text-[11px] text-amber-700 mt-0.5">No current-state map to compare against. Generate one above first.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current steps</p>
          <p className="text-base font-semibold">{stats.totalCurrentSteps}</p>
        </div>
        <div className="rounded-md border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Future steps</p>
          <p className="text-base font-semibold">{stats.totalFutureSteps}</p>
        </div>
        <div className="rounded-md border bg-violet-50 border-violet-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-violet-700">AI nodes added</p>
          <p className="text-base font-semibold text-violet-900">+{stats.addedAiNodes}</p>
        </div>
        <div className="rounded-md border bg-pink-50 border-pink-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pink-700">Guardrails added</p>
          <p className="text-base font-semibold text-pink-900">+{stats.addedGuardrails}</p>
        </div>
        <div className="rounded-md border bg-cyan-50 border-cyan-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-cyan-700">Monitoring nodes</p>
          <p className="text-base font-semibold text-cyan-900">+{stats.addedMonitoring}</p>
        </div>
        <div className="rounded-md border bg-emerald-50 border-emerald-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700">Human steps reduced</p>
          <p className="text-base font-semibold text-emerald-900">−{stats.humanLedReduced}</p>
        </div>
      </div>

      {future.expectedBenefits.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-800">Expected benefits</p>
          <ul className="text-xs mt-1 space-y-0.5">
            {future.expectedBenefits.map((b, i) => (
              <li key={i} className="text-muted-foreground leading-snug">+ {b}</li>
            ))}
          </ul>
        </div>
      )}

      {future.newRisksIntroduced.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-red-800">New risks introduced</p>
          <ul className="text-xs mt-1 space-y-0.5">
            {future.newRisksIntroduced.map((r, i) => (
              <li key={i} className="text-muted-foreground leading-snug">⚠ {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
