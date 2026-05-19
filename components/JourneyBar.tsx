"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PHASES, getPhaseForPath, isPhaseComplete, phaseProgress, type Phase } from "@/lib/journey";
import { cn } from "@/lib/utils";

export function JourneyBar() {
  const pathname = usePathname();
  const { project } = useWorkspace();

  if (!project) return null;

  const activePhase = getPhaseForPath(pathname, project.id);

  return (
    <div className="border-b bg-background">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-2 max-w-6xl mx-auto">
          {PHASES.map((phase, idx) => {
            const isActive = phase.id === activePhase.id;
            const complete = isPhaseComplete(project, phase.id);
            const progress = phaseProgress(project, phase.id);
            const firstTabHref = `/workspace/${project.id}${phase.tabs[0].href}`;

            return (
              <div key={phase.id} className="flex items-center gap-2 flex-1">
                <PhaseSegment
                  phase={phase}
                  href={firstTabHref}
                  isActive={isActive}
                  isComplete={complete}
                  progressDone={progress.done}
                  progressTotal={progress.total}
                />
                {idx < PHASES.length - 1 && (
                  <PhaseConnector complete={complete} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseSegment({
  phase,
  href,
  isActive,
  isComplete,
  progressDone,
  progressTotal,
}: {
  phase: Phase;
  href: string;
  isActive: boolean;
  isComplete: boolean;
  progressDone: number;
  progressTotal: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md transition-all min-w-0 group",
        isActive
          ? cn("bg-background border", phase.color.border, "shadow-sm")
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      <PhaseIndicator
        number={phase.number}
        isActive={isActive}
        isComplete={isComplete}
        accentColor={phase.color.accent}
        textColor={phase.color.text}
        bgSubtle={phase.color.bgSubtle}
        borderColor={phase.color.border}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-xs font-semibold leading-tight",
            isActive ? phase.color.text : "text-muted-foreground group-hover:text-foreground"
          )}>
            {phase.label}
          </p>
          {progressTotal > 0 && (
            <span className={cn(
              "text-[10px]",
              isComplete ? phase.color.text : "text-muted-foreground/60"
            )}>
              {progressDone}/{progressTotal}
            </span>
          )}
        </div>
        <p className={cn(
          "text-[10px] leading-tight truncate",
          isActive ? "text-muted-foreground" : "text-muted-foreground/70"
        )}>
          {phase.tagline}
        </p>
      </div>
    </Link>
  );
}

function PhaseIndicator({
  number,
  isActive,
  isComplete,
  accentColor,
  textColor,
  bgSubtle,
  borderColor,
}: {
  number: number;
  isActive: boolean;
  isComplete: boolean;
  accentColor: string;
  textColor: string;
  bgSubtle: string;
  borderColor: string;
}) {
  if (isComplete) {
    return (
      <span className={cn(
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white",
        accentColor,
      )}>
        ✓
      </span>
    );
  }
  return (
    <span className={cn(
      "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold",
      isActive ? cn(bgSubtle, textColor, borderColor) : "bg-muted text-muted-foreground border-muted-foreground/30",
    )}>
      {number}
    </span>
  );
}

function PhaseConnector({ complete }: { complete: boolean }) {
  return (
    <div className="flex-shrink-0 w-6 h-px relative">
      <div className={cn(
        "absolute inset-0 h-px",
        complete ? "bg-emerald-300" : "bg-border"
      )} />
    </div>
  );
}
