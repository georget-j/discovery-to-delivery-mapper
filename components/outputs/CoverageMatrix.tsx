"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { OnboardingProject } from "@/lib/types";
import {
  ARTIFACT_KEYS_ORDERED,
  ARTIFACT_LABELS,
  coverageCell,
  type ArtifactKey,
  type CoverageInputCategory,
  type CoverageStrength,
} from "@/lib/artifact-sources";
import { hashGenerationInputs } from "@/lib/artifact-helpers";

type Props = {
  project: OnboardingProject;
  onPickArtifact: (key: ArtifactKey) => void;
};

const CATEGORIES: { key: CoverageInputCategory; label: string; dot: string }[] =
  [
    { key: "customer", label: "Customer", dot: "bg-blue-600" },
    { key: "discovery", label: "Discovery", dot: "bg-slate-500" },
    { key: "regulatory", label: "Regulatory", dot: "bg-rose-500" },
    { key: "workflows", label: "Workflows", dot: "bg-blue-400" },
    { key: "systems", label: "Systems", dot: "bg-emerald-500" },
    { key: "data_sources", label: "Data sources", dot: "bg-cyan-500" },
    { key: "stakeholders", label: "Stakeholders", dot: "bg-purple-500" },
    { key: "risks", label: "Risks", dot: "bg-indigo-500" },
    { key: "pilot", label: "Pilot", dot: "bg-amber-500" },
  ];

// Bidirectional traceability view. Rows = input categories, columns = 15
// artifacts. Solid dot = all entities in that category fed the artifact;
// hollow dot = some did; empty = none.
export function CoverageMatrix({ project, onPickArtifact }: Props) {
  const [emptyOnly, setEmptyOnly] = useState(false);
  const hash = useMemo(() => hashGenerationInputs(project), [project]);
  const stale =
    !!project.outputs?.derivedFromHash &&
    project.outputs.derivedFromHash !== hash;

  // Precompute the whole grid
  const grid = useMemo(() => {
    const result: Record<
      CoverageInputCategory,
      Record<ArtifactKey, { strength: CoverageStrength; count: number }>
    > = {} as never;
    for (const cat of CATEGORIES) {
      result[cat.key] = {} as never;
      for (const a of ARTIFACT_KEYS_ORDERED) {
        result[cat.key][a] = coverageCell(project, a, cat.key);
      }
    }
    return result;
  }, [project]);

  // Identify uncaptured categories
  const captured = (cat: CoverageInputCategory): boolean => {
    switch (cat) {
      case "customer":
        return !!project.customer.companyName;
      case "discovery":
        return (
          !!project.discovery.currentProcess ||
          !!project.discovery.successDefinition
        );
      case "regulatory":
        return (project.customer.regulatoryContext?.length ?? 0) > 0;
      case "workflows":
        return project.workflows.length > 0;
      case "systems":
        return project.systems.length > 0;
      case "data_sources":
        return project.dataSources.length > 0;
      case "stakeholders":
        return project.stakeholders.length > 0;
      case "risks":
        return project.risks.length > 0;
      case "pilot":
        return !!project.pilotPlan?.objective;
    }
  };

  const visibleCategories = emptyOnly
    ? CATEGORIES.filter((c) => !captured(c.key))
    : CATEGORIES;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Input → output coverage</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Which inputs feed which artifact. Solid = all entries used. Hollow =
            some used. Empty = not used. Click any artifact label to jump to it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEmptyOnly((v) => !v)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md border transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            emptyOnly
              ? "bg-amber-50 border-amber-300 text-amber-900 font-medium"
              : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/30",
          )}
          aria-pressed={emptyOnly}
        >
          {emptyOnly ? "✓ Uncaptured only" : "Show uncaptured only"}
        </button>
      </div>

      {stale && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Inputs have changed since the last generation. Regenerate from the top
          of the Outputs page to refresh.
        </div>
      )}

      {/* Mobile card view — table is unreadable below md: */}
      <div className="md:hidden space-y-2">
        {visibleCategories.map((cat) => {
          const isCaptured = captured(cat.key);
          const cells = ARTIFACT_KEYS_ORDERED.map((art) => ({
            art,
            ...grid[cat.key][art],
          }));
          const feeds = cells.filter((c) => c.strength !== "none");
          return (
            <details
              key={cat.key}
              className={cn(
                "rounded-lg border bg-background",
                !isCaptured && "opacity-70",
              )}
            >
              <summary className="px-3 py-2 cursor-pointer list-none flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    isCaptured ? cat.dot : "bg-muted-foreground/30",
                  )}
                />
                <span
                  className={cn(
                    "font-medium text-sm flex-1",
                    !isCaptured && "italic text-muted-foreground",
                  )}
                >
                  {cat.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isCaptured ? `feeds ${feeds.length}/15` : "(empty)"}
                </span>
                <span className="text-xs text-muted-foreground/70" aria-hidden>
                  ▾
                </span>
              </summary>
              {isCaptured && feeds.length > 0 && (
                <div className="px-3 pb-3 pt-1 space-y-1.5">
                  {feeds.map((c) => (
                    <button
                      key={c.art}
                      type="button"
                      onClick={() => onPickArtifact(c.art)}
                      className="w-full text-left flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          c.strength === "solid"
                            ? cat.dot
                            : "bg-background border-2 " +
                                cat.dot.replace("bg-", "border-"),
                        )}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">
                        {ARTIFACT_LABELS[c.art]}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {c.strength === "solid"
                          ? `${c.count} feed`
                          : `${c.count} (subset)`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </details>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-background overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left font-semibold uppercase tracking-wider text-[10px] text-muted-foreground px-3 py-2 w-40">
                Input ↓ / Artifact →
              </th>
              {ARTIFACT_KEYS_ORDERED.map((key) => (
                <th
                  key={key}
                  className="text-left font-medium px-1 py-2 align-bottom"
                  style={{ minWidth: 90 }}
                >
                  <button
                    type="button"
                    onClick={() => onPickArtifact(key)}
                    title={ARTIFACT_LABELS[key]}
                    className="block text-[10px] leading-tight text-muted-foreground hover:text-foreground transition-colors text-left"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      maxHeight: 120,
                    }}
                  >
                    {ARTIFACT_LABELS[key]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map((cat) => {
              const isCaptured = captured(cat.key);
              return (
                <tr key={cat.key} className="border-b last:border-b-0">
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          isCaptured ? cat.dot : "bg-muted-foreground/30",
                        )}
                      />
                      <span
                        className={cn(
                          "font-medium",
                          !isCaptured && "text-muted-foreground italic",
                        )}
                      >
                        {cat.label}
                      </span>
                      {!isCaptured && (
                        <span className="text-[10px] text-muted-foreground/70">
                          (empty)
                        </span>
                      )}
                    </div>
                  </td>
                  {ARTIFACT_KEYS_ORDERED.map((art) => {
                    const cell = grid[cat.key][art];
                    return (
                      <td key={art} className="text-center px-1 py-2">
                        <DotCell
                          strength={cell.strength}
                          count={cell.count}
                          categoryDot={cat.dot}
                          captured={isCaptured}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-foreground inline-block" />
          Solid — all entities in this category feed the artifact
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border-2 border-foreground inline-block" />
          Hollow — some used (filtered subset)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 inline-block" />
          Empty — not used
        </span>
      </div>
    </div>
  );
}

function DotCell({
  strength,
  count,
  categoryDot,
  captured,
}: {
  strength: CoverageStrength;
  count: number;
  categoryDot: string;
  captured: boolean;
}) {
  if (strength === "none")
    return <span className="text-muted-foreground/30">·</span>;
  if (!captured) {
    return (
      <span
        className="text-muted-foreground/30"
        title={`Would use ${count}, but category is empty`}
      >
        ○
      </span>
    );
  }
  if (strength === "solid") {
    return (
      <span
        className={cn("inline-block w-2.5 h-2.5 rounded-full", categoryDot)}
        title={`${count} entity${count !== 1 ? "ies" : "y"} feed this artifact`}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full border-2 bg-background",
        categoryDot.replace("bg-", "border-"),
      )}
      title={`${count} entity${count !== 1 ? "ies" : "y"} feed this artifact (subset)`}
    />
  );
}
