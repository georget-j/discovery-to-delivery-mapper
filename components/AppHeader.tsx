"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { listScenarios } from "@/lib/scenarios";
import { listLocalProjects } from "@/lib/project-store";
import type { OnboardingProject } from "@/lib/types";

export function AppHeader() {
  const pathname = usePathname();

  const nav = [
    { href: "/", label: "Home" },
    { href: "/scenarios", label: "Scenarios" },
  ];

  // Extract workspace id from pathname (/workspace/[id]/...). null if not in a
  // workspace — the switcher only shows there.
  const workspaceId = (() => {
    const match = pathname.match(/^\/workspace\/([^/]+)/);
    return match ? match[1] : null;
  })();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 flex h-14 items-center gap-3 sm:gap-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-sm shrink-0"
        >
          <span className="text-primary">⬡</span>
          <span className="hidden sm:inline">Discovery to Delivery Mapper</span>
          <span className="sm:hidden">D→D Mapper</span>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === href
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {workspaceId && <ScenarioSwitcher activeId={workspaceId} />}
          {/* Hidden inside workspaces — "Portfolio Demo" undermines a
              customer-facing screen-share. */}
          {!workspaceId && (
            <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Portfolio Demo
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function ScenarioSwitcher({ activeId }: { activeId: string }) {
  const seeded = listScenarios();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<OnboardingProject[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Read local projects each time the menu opens so newly-created ones
  // show up without a route reload.
  useEffect(() => {
    if (open) setLocal(listLocalProjects());
  }, [open]);

  const active =
    seeded.find((s) => s.id === activeId) ??
    local.find((p) => p.id === activeId);
  const activeLabel =
    active?.customer.companyName?.trim() ||
    active?.name ||
    (activeId.startsWith("local-") ? "Untitled Project" : "Workspace");

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors max-w-[14rem]"
      >
        <span className="text-muted-foreground">Project:</span>
        <span className="font-medium truncate">{activeLabel}</span>
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-72 rounded-md border bg-popover shadow-lg z-50 p-1 max-h-[70vh] overflow-y-auto"
        >
          {local.length > 0 && (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                Your projects
              </p>
              {local.map((p) => (
                <ProjectMenuItem
                  key={p.id}
                  project={p}
                  isActive={p.id === activeId}
                  onClick={() => setOpen(false)}
                />
              ))}
              <div className="border-t my-1" />
            </>
          )}
          <p className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            Demo scenarios
          </p>
          {seeded.map((s) => (
            <ProjectMenuItem
              key={s.id}
              project={s}
              isActive={s.id === activeId}
              onClick={() => setOpen(false)}
            />
          ))}
          <div className="border-t mt-1 pt-1">
            <Link
              href="/scenarios"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
            >
              ← All scenarios + new project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectMenuItem({
  project,
  isActive,
  onClick,
}: {
  project: OnboardingProject;
  isActive: boolean;
  onClick: () => void;
}) {
  const label =
    project.customer.companyName?.trim() || project.name || "Untitled Project";
  return (
    <Link
      href={`/workspace/${project.id}`}
      onClick={onClick}
      role="menuitem"
      className={cn(
        "block px-3 py-2 rounded text-sm transition-colors",
        isActive
          ? "bg-muted font-medium"
          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="truncate flex-1">{label}</span>
        {isActive && (
          <span className="text-[10px] text-muted-foreground" aria-hidden>
            ●
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground/70 capitalize truncate">
        {project.customer.industry.replace(/_/g, " ")}
      </div>
    </Link>
  );
}
