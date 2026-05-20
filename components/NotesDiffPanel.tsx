"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ProvenancePopover } from "@/components/ui/provenance-popover";
import type { NotesExtractionResult, OnboardingProject } from "@/lib/types";

// Suggestion identity: stable key per row so user selections survive re-renders
// and let us return only the picked subset back to the apply handler.
type RowId =
  | `discovery:${string}`
  | `stakeholder:${number}`
  | `system:${number}`
  | `dataSource:${number}`
  | `workflow:${number}`
  | `risk:${number}`
  | `actionItem:${number}`;

type Row = {
  id: RowId;
  kind:
    | "discovery"
    | "stakeholder"
    | "system"
    | "dataSource"
    | "workflow"
    | "risk"
    | "actionItem";
  title: string;
  detail?: string;
  existing?: boolean;
  rationale?: string;
};

type Props = {
  suggestions: NotesExtractionResult;
  project: OnboardingProject;
  onApply: (selected: Set<RowId>) => void;
  onCancel: () => void;
};

// Review panel that shows every suggestion as a checkable row before any
// project state mutates. Replaces the old "Apply all" silent mutation.
// User picks which rows to apply; the apply handler receives the chosen set
// and patches the project accordingly.
export function NotesDiffPanel({
  suggestions,
  project,
  onApply,
  onCancel,
}: Props) {
  const rows = useMemo(
    () => buildRows(suggestions, project),
    [suggestions, project],
  );
  const [selected, setSelected] = useState<Set<RowId>>(
    () => new Set(rows.filter((r) => !r.existing).map((r) => r.id)),
  );

  const toggle = (id: RowId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const grouped = useMemo(() => {
    const buckets: Record<Row["kind"], Row[]> = {
      discovery: [],
      stakeholder: [],
      system: [],
      dataSource: [],
      workflow: [],
      risk: [],
      actionItem: [],
    };
    for (const r of rows) buckets[r.kind].push(r);
    return buckets;
  }, [rows]);

  const totalNew = rows.filter((r) => !r.existing).length;
  const pickedCount = selected.size;

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            Review extracted suggestions
            {suggestions.summary && (
              <ProvenancePopover rationale={suggestions.summary} />
            )}
          </p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            {totalNew} new item{totalNew !== 1 ? "s" : ""} — picked{" "}
            <span className="font-medium text-foreground">{pickedCount}</span>.
            Nothing is applied until you click below.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(selected)}
            disabled={pickedCount === 0}
            className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply {pickedCount} selected
          </button>
        </div>
      </div>

      <Group
        label="Discovery"
        rows={grouped.discovery}
        selected={selected}
        onToggle={toggle}
      />
      <Group
        label="Stakeholders"
        rows={grouped.stakeholder}
        selected={selected}
        onToggle={toggle}
      />
      <Group
        label="Workflows"
        rows={grouped.workflow}
        selected={selected}
        onToggle={toggle}
      />
      <Group
        label="Systems"
        rows={grouped.system}
        selected={selected}
        onToggle={toggle}
      />
      <Group
        label="Data Sources"
        rows={grouped.dataSource}
        selected={selected}
        onToggle={toggle}
      />
      <Group
        label="Risks"
        rows={grouped.risk}
        selected={selected}
        onToggle={toggle}
      />
      <Group
        label="Action Items"
        rows={grouped.actionItem}
        selected={selected}
        onToggle={toggle}
      />
    </div>
  );
}

function Group({
  label,
  rows,
  selected,
  onToggle,
}: {
  label: string;
  rows: Row[];
  selected: Set<RowId>;
  onToggle: (id: RowId) => void;
}) {
  if (rows.length === 0) return null;
  const newCount = rows.filter((r) => !r.existing).length;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {label} <span className="font-normal">· {newCount} new</span>
      </p>
      <ul className="space-y-1">
        {rows.map((r) => {
          const checked = selected.has(r.id);
          return (
            <li
              key={r.id}
              className={cn(
                "rounded border bg-background px-2.5 py-1.5 text-xs flex items-start gap-2",
                r.existing && "opacity-60",
                checked && !r.existing && "border-emerald-200 bg-emerald-50/30",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={r.existing}
                onChange={() => onToggle(r.id)}
                className="mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                aria-label={`Apply ${r.title}`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-snug inline-flex items-center gap-1.5">
                  <span className={r.existing ? "line-through" : ""}>
                    {r.title}
                  </span>
                  {r.rationale && <ProvenancePopover rationale={r.rationale} />}
                  {r.existing && (
                    <span className="text-[10px] text-muted-foreground italic">
                      already in project
                    </span>
                  )}
                </p>
                {r.detail && (
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {r.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildRows(s: NotesExtractionResult, p: OnboardingProject): Row[] {
  const rows: Row[] = [];

  // Discovery — one row per non-empty field
  if (s.discovery) {
    const entries = Object.entries(s.discovery).filter(([, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return Boolean(v);
    });
    for (const [key, value] of entries) {
      rows.push({
        id: `discovery:${key}`,
        kind: "discovery",
        title: humaniseDiscoveryKey(key),
        detail: Array.isArray(value) ? value.join(", ") : String(value),
        rationale: `Detected from the notes — would set ${key} on the project.`,
      });
    }
  }

  // Stakeholders
  const existingStakeholders = new Set(
    p.stakeholders.map((x) => x.name.toLowerCase()),
  );
  (s.suggestedStakeholders ?? []).forEach((row, i) => {
    rows.push({
      id: `stakeholder:${i}`,
      kind: "stakeholder",
      title: `${row.name}${row.role ? ` · ${row.role}` : ""}`,
      detail: [row.team, row.concerns.join(", ")].filter(Boolean).join(" — "),
      existing: existingStakeholders.has(row.name.toLowerCase()),
      rationale: row.concerns.length
        ? `Mentioned with concerns: ${row.concerns.slice(0, 2).join(", ")}.`
        : `Named in the notes as a stakeholder.`,
    });
  });

  // Workflows
  const existingWorkflows = new Set(
    p.workflows.map((x) => x.name.toLowerCase()),
  );
  (s.suggestedWorkflows ?? []).forEach((row, i) => {
    rows.push({
      id: `workflow:${i}`,
      kind: "workflow",
      title: row.name,
      detail: row.description,
      existing: existingWorkflows.has(row.name.toLowerCase()),
      rationale: row.painPoints?.length
        ? `Pain points mentioned: ${row.painPoints.slice(0, 2).join(", ")}.`
        : `Process step described in the notes.`,
    });
  });

  // Systems
  const existingSystems = new Set(p.systems.map((x) => x.name.toLowerCase()));
  (s.suggestedSystems ?? []).forEach((row, i) => {
    rows.push({
      id: `system:${i}`,
      kind: "system",
      title: row.name,
      detail: [row.type, row.notes].filter(Boolean).join(" · "),
      existing: existingSystems.has(row.name.toLowerCase()),
      rationale: `${row.name} was named as a system the AI will touch.`,
    });
  });

  // Data sources
  const existingSources = new Set(
    p.dataSources.map((x) => x.name.toLowerCase()),
  );
  (s.suggestedDataSources ?? []).forEach((row, i) => {
    rows.push({
      id: `dataSource:${i}`,
      kind: "dataSource",
      title: row.name,
      detail: [row.dataType, row.format, row.notes].filter(Boolean).join(" · "),
      existing: existingSources.has(row.name.toLowerCase()),
      rationale: `Data source referenced in the notes.`,
    });
  });

  // Risks
  const existingRisks = new Set(p.risks.map((x) => x.title.toLowerCase()));
  (s.suggestedRisks ?? []).forEach((row, i) => {
    rows.push({
      id: `risk:${i}`,
      kind: "risk",
      title: row.title,
      detail: row.description,
      existing: existingRisks.has(row.title.toLowerCase()),
      rationale: row.mitigation
        ? `Mitigation suggested: ${row.mitigation.slice(0, 80)}…`
        : `Risk surfaced from the notes context.`,
    });
  });

  // Action items
  (s.suggestedActionItems ?? []).forEach((row, i) => {
    rows.push({
      id: `actionItem:${i}`,
      kind: "actionItem",
      title: row.title,
      detail: [
        row.assignee && `Owner: ${row.assignee}`,
        row.dueDate && `Due: ${row.dueDate}`,
      ]
        .filter(Boolean)
        .join(" · "),
      rationale: `Captured as a next step in the notes.`,
    });
  });

  return rows;
}

function humaniseDiscoveryKey(key: string): string {
  switch (key) {
    case "businessProblem":
      return "Business problem";
    case "primaryUseCase":
      return "Primary use case";
    case "desiredOutcome":
      return "Desired outcome";
    case "currentProcess":
      return "Current process";
    case "successDefinition":
      return "Success definition";
    case "implementationDeadline":
      return "Implementation deadline";
    case "buyerTeam":
      return "Buyer team";
    case "constraints":
      return "Constraints";
    case "regulatoryContext":
      return "Regulatory context";
    default:
      return key;
  }
}

export type { RowId };
