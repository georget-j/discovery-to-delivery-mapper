"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/WorkspaceProvider";
import {
  PHASES,
  isPhaseComplete,
  phaseProgress,
  type Phase,
} from "@/lib/journey";

// Inner content reused by both the desktop <aside> and the mobile drawer.
// Accepts an optional onNavigate callback so the drawer can close itself
// when the user picks a tab.
export function WorkspaceSidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { project } = useWorkspace();
  const base = project ? `/workspace/${project.id}` : "";

  return (
    <>
      <div className="px-4 py-4 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Customer
        </p>
        <p className="text-sm font-semibold mt-0.5 truncate">
          {project?.customer.companyName ?? "Loading…"}
        </p>
        {project && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
              {project.status}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {project.customer.industry.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {PHASES.map((phase) => (
          <PhaseGroup
            key={phase.id}
            phase={phase}
            base={base}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <Link
          href="/scenarios"
          onClick={onNavigate}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All Scenarios
        </Link>
      </div>
    </>
  );
}

// Desktop sidebar. Hidden on mobile; the JourneyBar's hamburger opens an
// off-canvas drawer that renders WorkspaceSidebarContent instead.
export function WorkspaceSidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 border-r border-border bg-muted/20 flex-col">
      <WorkspaceSidebarContent />
    </aside>
  );
}

function PhaseGroup({
  phase,
  base,
  pathname,
  onNavigate,
}: {
  phase: Phase;
  base: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { project } = useWorkspace();
  const complete = isPhaseComplete(project, phase.id);
  const progress = phaseProgress(project, phase.id);

  return (
    <div className="px-2 py-1.5">
      <div className="px-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
              complete
                ? cn(phase.color.accent, "text-white")
                : cn(
                    phase.color.bgSubtle,
                    phase.color.text,
                    "border",
                    phase.color.border,
                  ),
            )}
          >
            {complete ? "✓" : phase.number}
          </span>
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              phase.color.text,
            )}
          >
            {phase.label}
          </p>
        </div>
        <span
          className="text-[10px] text-muted-foreground/60 cursor-help"
          title={progress.checks
            .map((c) => `${c.done ? "✓" : "✗"} ${c.label}`)
            .join("\n")}
        >
          {progress.done}/{progress.total}
        </span>
      </div>

      <div className="space-y-0.5">
        {phase.tabs.map((tab) => {
          const fullHref = `${base}${tab.href}`;
          const isActive = pathname === fullHref;
          return (
            <Link
              key={fullHref}
              href={fullHref}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 ml-5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                isActive
                  ? cn(
                      "bg-background font-medium shadow-sm border",
                      phase.color.border,
                      phase.color.text,
                    )
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "w-1 h-1 rounded-full shrink-0",
                  isActive ? phase.color.accent : "bg-muted-foreground/30",
                )}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
