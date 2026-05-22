"use client";

import { useState, useMemo } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { ActionItem, ActionItemUrgency } from "@/lib/types";

const URGENCY_STYLE: Record<ActionItemUrgency, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

// Aggregated action item list across every discovery session. Renders on the
// Overview above Open Actions. Items can be checked off in place, which writes
// back to the owning session.
export function ActionItems() {
  const { project, updateProject } = useWorkspace();
  const [filter, setFilter] = useState<"open" | "all" | "overdue">("open");

  if (!project) return null;
  const sessions = project.meetingSessions ?? [];

  // Flatten all action items + remember which session each belongs to.
  const allItems = useMemo(
    () =>
      sessions.flatMap((s) =>
        s.actionItems.map((item) => ({
          item,
          sessionId: s.id,
          sessionTitle: s.title || "Untitled session",
        })),
      ),
    [sessions],
  );

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return allItems.filter(({ item }) => {
      if (filter === "open" && item.status !== "open") return false;
      if (filter === "overdue") {
        if (item.status !== "open") return false;
        if (!item.dueDate) return false;
        // Compare YYYY-MM-DD lexicographically — accurate for ISO dates.
        if (item.dueDate > today) return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) return false;
      }
      return true;
    });
  }, [allItems, filter, today]);

  // Sort: overdue first, then by due date asc (nulls last), then by urgency.
  const sorted = useMemo(() => {
    const URGENCY_RANK: Record<ActionItemUrgency, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return [...filtered].sort((a, b) => {
      const aOverdue =
        a.item.dueDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(a.item.dueDate) &&
        a.item.dueDate < today;
      const bOverdue =
        b.item.dueDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(b.item.dueDate) &&
        b.item.dueDate < today;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const aDue = a.item.dueDate || "9999-99-99";
      const bDue = b.item.dueDate || "9999-99-99";
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return URGENCY_RANK[a.item.urgency] - URGENCY_RANK[b.item.urgency];
    });
  }, [filtered, today]);

  const openCount = allItems.filter(
    ({ item }) => item.status === "open",
  ).length;
  const overdueCount = allItems.filter(
    ({ item }) =>
      item.status === "open" &&
      item.dueDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) &&
      item.dueDate < today,
  ).length;

  if (allItems.length === 0) return null;

  const toggleDone = (item: ActionItem, sessionId: string) => {
    updateProject({
      meetingSessions: sessions.map((s) =>
        s.id !== sessionId
          ? s
          : {
              ...s,
              actionItems: s.actionItems.map((a) =>
                a.id !== item.id
                  ? a
                  : {
                      ...a,
                      status: a.status === "done" ? "open" : ("done" as const),
                    },
              ),
            },
      ),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Action Items
          <span className="ml-2 text-xs font-normal normal-case text-muted-foreground/80">
            {openCount} open
            {overdueCount > 0 && (
              <span className="text-red-700 font-medium">
                {" "}
                · {overdueCount} overdue
              </span>
            )}
          </span>
        </h2>
        <div className="flex gap-1">
          {(["open", "overdue", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "text-xs px-2 py-0.5 rounded border transition-colors capitalize",
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background hover:bg-muted/50 text-muted-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground italic">
          {filter === "open"
            ? "No open action items."
            : filter === "overdue"
              ? "Nothing overdue. ✓"
              : "No action items in any session."}
        </div>
      ) : (
        <Surface className="divide-y">
          {sorted.map(({ item, sessionId, sessionTitle }) => {
            const isDone = item.status === "done";
            const isOverdue =
              item.dueDate &&
              /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) &&
              item.dueDate < today &&
              !isDone;
            return (
              <div key={item.id} className="flex items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggleDone(item, sessionId)}
                  className="mt-0.5 shrink-0"
                  aria-label={`Mark ${item.title} as ${isDone ? "open" : "done"}`}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      isDone && "line-through text-muted-foreground",
                    )}
                  >
                    {item.title || (
                      <span className="italic text-muted-foreground">
                        (no title)
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    {item.assignee && <span>👤 {item.assignee}</span>}
                    {item.dueDate && (
                      <span
                        className={cn(isOverdue && "text-red-700 font-medium")}
                      >
                        📅 {item.dueDate}
                        {isOverdue && " (overdue)"}
                      </span>
                    )}
                    <span className="text-muted-foreground/60">
                      from: {sessionTitle}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 capitalize",
                    URGENCY_STYLE[item.urgency],
                  )}
                >
                  {item.urgency}
                </span>
              </div>
            );
          })}
        </Surface>
      )}
    </div>
  );
}
