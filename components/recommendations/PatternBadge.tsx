"use client";

import { cn } from "@/lib/utils";
import { PATTERN_FAMILY_COLOR } from "@/lib/patterns/future-state-patterns";
import type { AutomationPatternFamily } from "@/lib/types";

type Props = {
  family: AutomationPatternFamily;
  patternName?: string;
  className?: string;
};

const FAMILY_LABEL: Record<AutomationPatternFamily, string> = {
  agent: "Single agent",
  agent_with_validator: "Agent + validator",
  multi_agent: "Multi-agent",
  rag: "RAG",
  rules_plus_ai: "Rules + AI",
  hitl: "HITL",
  continuous_learning: "Continuous learning",
  copilot: "Co-pilot",
};

export function PatternBadge({ family, patternName, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border",
        PATTERN_FAMILY_COLOR[family],
        className,
      )}
      title={patternName ?? FAMILY_LABEL[family]}
    >
      {patternName ?? FAMILY_LABEL[family]}
    </span>
  );
}
