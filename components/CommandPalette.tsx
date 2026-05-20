"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { ALL_TABS, PHASES } from "@/lib/journey";
import { listScenarios } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  group: "Navigate" | "Add" | "Generate" | "Scenarios";
  hint?: string;
  run: () => void;
};

type Props = {
  projectId: string;
};

// Cmd/Ctrl+K opens a centred command list. Type to filter, Enter to run.
// Routes are resolved via next/navigation so the existing in-app navigation
// fires (project context, prefetch, etc).
export function CommandPalette({ projectId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navTabs: Command[] = ALL_TABS.map(({ tab, phase }) => ({
      id: `nav:${tab.href}`,
      label: `Go to ${tab.label}`,
      hint: `${phase.label} · ${tab.description}`,
      group: "Navigate",
      run: () => {
        router.push(`/workspace/${projectId}${tab.href}`);
      },
    }));
    const navPhases: Command[] = PHASES.map((p) => ({
      id: `phase:${p.id}`,
      label: `Open ${p.label} phase`,
      hint: p.tagline,
      group: "Navigate",
      run: () => {
        router.push(`/workspace/${projectId}${p.tabs[0].href}`);
      },
    }));
    const adds: Command[] = [
      {
        id: "add:stakeholder",
        label: "Add stakeholder",
        hint: "Discovery tab",
        group: "Add",
        run: () =>
          router.push(`/workspace/${projectId}/discovery#stakeholders`),
      },
      {
        id: "add:system",
        label: "Add system / data source",
        hint: "Systems tab",
        group: "Add",
        run: () => router.push(`/workspace/${projectId}/systems`),
      },
      {
        id: "add:workflow",
        label: "Add workflow step",
        hint: "Workflow tab",
        group: "Add",
        run: () => router.push(`/workspace/${projectId}/workflow`),
      },
      {
        id: "add:risk",
        label: "Add risk",
        hint: "Risks tab",
        group: "Add",
        run: () => router.push(`/workspace/${projectId}/risks`),
      },
      {
        id: "add:requirement",
        label: "Add requirement",
        hint: "Requirements tab",
        group: "Add",
        run: () => router.push(`/workspace/${projectId}/requirements`),
      },
    ];
    const generate: Command[] = [
      {
        id: "generate:pack",
        label: "Generate deployment pack",
        hint: "Outputs tab",
        group: "Generate",
        run: () => router.push(`/workspace/${projectId}/outputs`),
      },
    ];
    const scenarios: Command[] = listScenarios().map((s) => ({
      id: `scenario:${s.id}`,
      label: `Switch to ${s.customer.companyName}`,
      hint: s.customer.industry,
      group: "Scenarios",
      run: () => router.push(`/workspace/${s.id}`),
    }));
    return [...navTabs, ...navPhases, ...adds, ...generate, ...scenarios];
  }, [router, projectId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const run = (cmd: Command) => {
    cmd.run();
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) run(cmd);
    }
  };

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Flat index → for keyboard selection vs grouped render
  let flatIdx = -1;

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      ariaLabel="Command palette"
    >
      <div
        className="mx-auto max-w-xl w-full bg-background rounded-t-lg sm:rounded-lg sm:mt-20 shadow-lg border overflow-hidden"
        onKeyDown={handleKey}
      >
        <div className="px-3 py-2 border-b">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…  (Cmd+K)"
            className="w-full bg-transparent outline-none text-sm py-1"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No commands match.
            </p>
          )}
          {grouped.map(([group, cmds]) => (
            <div key={group} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {group}
              </p>
              {cmds.map((c) => {
                flatIdx += 1;
                const isActive = flatIdx === selected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => run(c)}
                    className={cn(
                      "w-full flex items-center justify-between text-left px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-foreground hover:bg-muted/50",
                    )}
                  >
                    <span className="truncate">{c.label}</span>
                    {c.hint && (
                      <span className="ml-3 text-[11px] text-muted-foreground truncate max-w-[40%]">
                        {c.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground flex items-center justify-between bg-muted/20">
          <span>↑↓ to navigate · Enter to run · Esc to close</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </Sheet>
  );
}
