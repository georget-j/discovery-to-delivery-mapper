"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { pendingSuggestionCountForTab } from "@/components/SuggestionsBanner";
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

  // Persist mobile sidebar scroll offset across Sheet open/close so users
  // don't lose their place after picking a tab. Keyed per project so two
  // workspaces don't fight over the same offset.
  const navRef = useRef<HTMLElement | null>(null);
  const scrollKey = project ? `sidebar-scroll-${project.id}` : "sidebar-scroll";
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navRef.current;
    if (!nav) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) nav.scrollTop = parseInt(saved, 10) || 0;
    const onScroll = () => {
      sessionStorage.setItem(scrollKey, String(nav.scrollTop));
    };
    nav.addEventListener("scroll", onScroll, { passive: true });
    return () => nav.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  return (
    <>
      <div className="px-4 py-4 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Customer
        </p>
        <p className="text-sm font-semibold mt-0.5 truncate">
          {project
            ? project.customer.companyName?.trim() ||
              project.name ||
              "Untitled Project"
            : "Loading…"}
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

      <nav ref={navRef} className="flex-1 overflow-y-auto py-2">
        {PHASES.map((phase) => {
          const isActivePhase = phase.tabs.some(
            (t) => pathname === `${base}${t.href}`,
          );
          return (
            <PhaseGroup
              key={phase.id}
              phase={phase}
              base={base}
              pathname={pathname}
              isActivePhase={isActivePhase}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>
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
  isActivePhase,
  onNavigate,
}: {
  phase: Phase;
  base: string;
  pathname: string;
  isActivePhase: boolean;
  onNavigate?: () => void;
}) {
  const { project } = useWorkspace();
  const complete = isPhaseComplete(project, phase.id);
  const progress = phaseProgress(project, phase.id);

  return (
    <div
      className={cn(
        "pl-2 pr-2 py-1.5 border-l-2 transition-colors",
        isActivePhase ? phase.color.border : "border-transparent",
      )}
    >
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
          const suggestionCount = pendingSuggestionCountForTab(
            project?.pendingSuggestions,
            tab.href,
          );
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
              {suggestionCount > 0 && (
                <span
                  className="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-px rounded-full bg-amber-100 text-amber-800 border border-amber-300"
                  title={`${suggestionCount} AI suggestion${suggestionCount !== 1 ? "s" : ""} to review`}
                >
                  {suggestionCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
