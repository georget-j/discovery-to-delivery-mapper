"use client";

import { cn } from "@/lib/utils";
import type { FutureState, WorkflowStep } from "@/lib/types";

type Props = {
  steps: WorkflowStep[];
  onJumpToStep?: () => void;  // jump to Steps tab so user can edit
};

const FUTURE_STATE_STYLE: Record<FutureState, { pill: string; dot: string; label: string }> = {
  human_led:         { pill: "bg-slate-100 text-slate-700 border-slate-300",   dot: "bg-slate-400",  label: "Human-Led" },
  ai_assisted:       { pill: "bg-blue-100 text-blue-800 border-blue-300",      dot: "bg-blue-500",   label: "AI-Assisted" },
  automated:         { pill: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500", label: "Automated" },
  requires_approval: { pill: "bg-amber-100 text-amber-800 border-amber-300",   dot: "bg-amber-500",  label: "Requires Approval" },
};

export function WorkflowAtAGlance({ steps, onJumpToStep }: Props) {
  if (steps.length === 0) return null;

  const highAuto = steps.filter((s) => s.automationPotential === "high").length;
  const automated = steps.filter((s) => s.futureState === "automated").length;
  const aiAssisted = steps.filter((s) => s.futureState === "ai_assisted").length;

  // Which legend items appear depends on which futureStates exist on the steps.
  const usedFutureStates = Array.from(new Set(steps.map((s) => s.futureState)));

  return (
    <div className="rounded-lg border bg-muted/15 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Workflow at a glance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {steps.length} step{steps.length !== 1 ? "s" : ""}
            {" · "}{highAuto} high-automation
            {" · "}{automated} fully automated
            {" · "}{aiAssisted} AI-assisted
          </p>
        </div>
        {onJumpToStep && (
          <button
            type="button"
            onClick={onJumpToStep}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline"
          >
            Edit steps →
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const style = FUTURE_STATE_STYLE[step.futureState];
          return (
            <div key={step.id} className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onJumpToStep}
                title={`Step ${i + 1}: ${step.name || "Unnamed"} (${style.label})`}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md border font-medium max-w-[180px] truncate transition-transform hover:scale-[1.02]",
                  style.pill,
                )}
              >
                <span className="text-[10px] opacity-60 mr-1">{i + 1}.</span>
                {step.name || <span className="italic opacity-60">Unnamed</span>}
              </button>
              {i < steps.length - 1 && (
                <span className="text-muted-foreground/40 text-xs select-none">→</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] pt-1 border-t">
        <span className="text-muted-foreground">Future state:</span>
        {usedFutureStates.map((fs) => {
          const style = FUTURE_STATE_STYLE[fs];
          return (
            <span key={fs} className="inline-flex items-center gap-1 text-muted-foreground">
              <span className={cn("w-2 h-2 rounded-full", style.dot)} />
              {style.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
