"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { listScenarios } from "@/lib/scenarios";

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
          <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Portfolio Demo
          </span>
        </div>
      </div>
    </header>
  );
}

function ScenarioSwitcher({ activeId }: { activeId: string }) {
  const scenarios = listScenarios();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const active = scenarios.find((s) => s.id === activeId);

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
        <span className="text-muted-foreground">Scenario:</span>
        <span className="font-medium truncate">
          {active?.customer.companyName ?? "Workspace"}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-72 rounded-md border bg-popover shadow-lg z-50 p-1 max-h-[70vh] overflow-y-auto"
        >
          {scenarios.map((s) => {
            const isActive = s.id === activeId;
            return (
              <Link
                key={s.id}
                href={`/workspace/${s.id}`}
                onClick={() => setOpen(false)}
                role="menuitem"
                className={cn(
                  "block px-3 py-2 rounded text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium"
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate flex-1">
                    {s.customer.companyName}
                  </span>
                  {isActive && (
                    <span
                      className="text-[10px] text-muted-foreground"
                      aria-hidden
                    >
                      ●
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground/70 capitalize truncate">
                  {s.customer.industry.replace(/_/g, " ")}
                </div>
              </Link>
            );
          })}
          <div className="border-t mt-1 pt-1">
            <Link
              href="/scenarios"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
            >
              ← All scenarios
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
