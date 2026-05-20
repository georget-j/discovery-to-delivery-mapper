"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceSidebarContent } from "@/components/WorkspaceSidebar";
import { Sheet } from "@/components/ui/sheet";
import {
  PHASES,
  getPhaseForPath,
  isPhaseComplete,
  phaseProgress,
  type Phase,
} from "@/lib/journey";
import { cn } from "@/lib/utils";

export function JourneyBar() {
  const pathname = usePathname();
  const { project } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phasePickerOpen, setPhasePickerOpen] = useState(false);

  if (!project) return null;

  const activePhase = getPhaseForPath(pathname, project.id);
  const activeProgress = phaseProgress(project, activePhase.id);
  const totalSteps = PHASES.reduce(
    (sum, p) => sum + phaseProgress(project, p.id).total,
    0,
  );
  const doneSteps = PHASES.reduce(
    (sum, p) => sum + phaseProgress(project, p.id).done,
    0,
  );

  return (
    <div className="border-b bg-background">
      {/* Desktop: 4-phase horizontal layout */}
      <div className="hidden md:block px-6 py-3">
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

      {/* Mobile: hamburger + active phase + project completion */}
      <div className="md:hidden flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open workspace navigation"
          className="shrink-0 w-10 h-10 rounded-md hover:bg-muted/50 flex items-center justify-center"
        >
          <span aria-hidden className="block w-5 h-3 relative">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-foreground" />
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-foreground" />
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPhasePickerOpen(true)}
          className={cn(
            "flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-md border transition-colors hover:bg-muted/50",
            activePhase.color.border,
            activePhase.color.bgSubtle,
          )}
        >
          <span
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
              activePhase.color.accent,
            )}
          >
            {activePhase.number}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p
              className={cn(
                "text-xs font-bold leading-tight",
                activePhase.color.text,
              )}
            >
              {activePhase.label}
            </p>
            <p className="text-[10px] text-muted-foreground/80 truncate">
              {activeProgress.done}/{activeProgress.total} · tap to switch phase
            </p>
          </div>
          <span className={cn("text-xs shrink-0", activePhase.color.text)}>
            ▾
          </span>
        </button>

        <div
          className="shrink-0 w-10 h-10 flex items-center justify-center"
          title={`${doneSteps}/${totalSteps} steps complete`}
        >
          <CompletionRing done={doneSteps} total={totalSteps} />
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        side="left"
        ariaLabel="Workspace navigation"
      >
        <WorkspaceSidebarContent onNavigate={() => setSidebarOpen(false)} />
      </Sheet>

      {/* Mobile phase picker */}
      <Sheet
        open={phasePickerOpen}
        onOpenChange={setPhasePickerOpen}
        side="bottom"
        ariaLabel="Pick a phase"
      >
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Jump to phase
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PHASES.map((phase) => {
              const isActive = phase.id === activePhase.id;
              const complete = isPhaseComplete(project, phase.id);
              const progress = phaseProgress(project, phase.id);
              const firstTabHref = `/workspace/${project.id}${phase.tabs[0].href}`;
              return (
                <Link
                  key={phase.id}
                  href={firstTabHref}
                  onClick={() => setPhasePickerOpen(false)}
                  className={cn(
                    "rounded-lg border-2 p-3 flex flex-col gap-1",
                    isActive
                      ? cn(phase.color.border, phase.color.bgSubtle)
                      : "border-border bg-background",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        complete
                          ? cn(phase.color.accent, "text-white")
                          : cn(
                              phase.color.bgSubtle,
                              phase.color.text,
                              "border-2",
                              phase.color.border,
                            ),
                      )}
                    >
                      {complete ? "✓" : phase.number}
                    </span>
                    <span className={cn("text-sm font-bold", phase.color.text)}>
                      {phase.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {phase.tagline}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {progress.done}/{progress.total} steps
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function CompletionRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        strokeWidth="3"
        className="stroke-muted"
      />
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        strokeWidth="3"
        className="stroke-emerald-500 transition-all"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
      <text
        x="16"
        y="20"
        textAnchor="middle"
        className="text-[10px] fill-foreground font-semibold"
      >
        {Math.round(pct * 100)}
      </text>
    </svg>
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
          : "hover:bg-muted/50 border border-transparent",
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
          <p
            className={cn(
              "text-xs font-semibold leading-tight",
              isActive
                ? phase.color.text
                : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            {phase.label}
          </p>
          {progressTotal > 0 && (
            <span
              className={cn(
                "text-[10px]",
                isComplete ? phase.color.text : "text-muted-foreground/60",
              )}
            >
              {progressDone}/{progressTotal}
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-[10px] leading-tight truncate",
            isActive ? "text-muted-foreground" : "text-muted-foreground/70",
          )}
        >
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
      <span
        className={cn(
          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white",
          accentColor,
        )}
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold",
        isActive
          ? cn(bgSubtle, textColor, borderColor)
          : "bg-muted text-muted-foreground border-muted-foreground/30",
      )}
    >
      {number}
    </span>
  );
}

function PhaseConnector({ complete }: { complete: boolean }) {
  return (
    <div className="flex-shrink-0 w-6 h-px relative">
      <div
        className={cn(
          "absolute inset-0 h-px",
          complete ? "bg-emerald-300" : "bg-border",
        )}
      />
    </div>
  );
}
