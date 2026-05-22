"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PatternBadge } from "./PatternBadge";
import type { FutureStateRecommendation, WorkflowStep } from "@/lib/types";

type Props = {
  rec: FutureStateRecommendation;
  step?: WorkflowStep;
  applied: boolean;
  onApply: (rec: FutureStateRecommendation) => void;
  onDismiss: (recId: string) => void;
  onShowSources?: (chunkIds: string[]) => void;
};

export function RecommendationCard({
  rec,
  step,
  applied,
  onApply,
  onDismiss,
  onShowSources,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const stepLabel = step ? `Step: ${step.name}` : "Workflow-level";
  const grounded = rec.sourceChunkIds && rec.sourceChunkIds.length > 0;

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{rec.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PatternBadge family={rec.patternFamily} />
            <span className="text-[11px] text-muted-foreground">
              {stepLabel}
            </span>
            <ConfidenceBar value={rec.confidence} />
            {grounded && onShowSources && (
              <button
                type="button"
                onClick={() => onShowSources(rec.sourceChunkIds ?? [])}
                className="text-[11px] text-teal-700 hover:underline"
              >
                📎 Grounded in {rec.sourceChunkIds!.length} chunk
                {rec.sourceChunkIds!.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
        {applied && (
          <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Applied
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
        {rec.valueProposition}
      </p>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded ? "Hide details ▲" : "Show details ▼"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <Section title="Rationale">{rec.rationale}</Section>
          <Section title="Future-state description">
            {rec.apply.futureStateDescription}
          </Section>
          {rec.risks.length > 0 && (
            <Section title="Introduces risks">
              <ul className="list-disc pl-4">
                {rec.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {!applied && (
          <button
            type="button"
            onClick={() => onApply(rec)}
            className="text-xs px-2.5 py-1 rounded bg-foreground text-background hover:bg-foreground/90 font-medium"
          >
            Apply{step ? ` to ${step.name}` : ""}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(rec.id)}
          className={cn(
            "text-xs px-2.5 py-1 rounded border hover:bg-muted/30",
            applied && "text-muted-foreground",
          )}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
      title={`Confidence: ${pct}%`}
    >
      <span className="inline-block w-12 h-1 rounded bg-muted overflow-hidden">
        <span
          className={cn("block h-full", color)}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span>{pct}%</span>
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {title}
      </p>
      <div className="text-xs leading-relaxed mt-0.5">{children}</div>
    </div>
  );
}
