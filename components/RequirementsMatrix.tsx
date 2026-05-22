"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { CHIP } from "@/lib/semantic-colors";
import { EvidenceTrail } from "@/components/EvidenceTrail";
import { ProvenancePopover } from "@/components/ui/provenance-popover";
import type {
  Requirement,
  RequirementCategory,
  RequirementPriority,
} from "@/lib/types";

type Props = {
  requirements: Requirement[];
  manualIds?: Set<string>;
  onDelete?: (id: string) => void;
  /** When provided, the empty state renders a "Run requirement detection" CTA. */
  onDetect?: () => void;
};

const CATEGORY_LABELS: Record<RequirementCategory, string> = {
  functional: "Functional",
  technical: "Technical",
  data: "Data",
  integration: "Integration",
  security: "Security",
  compliance: "Compliance",
  reporting: "Reporting",
  support: "Support",
  change_management: "Change Management",
};

const PRIORITY_COLORS: Record<RequirementPriority, string> = {
  must_have: CHIP.critical,
  should_have: CHIP.medium,
  nice_to_have: CHIP.neutral,
};

const STATUS_COLORS: Record<Requirement["status"], string> = {
  confirmed: CHIP.success,
  assumption: CHIP.info,
  needs_validation: CHIP.high,
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as RequirementCategory[];
const ALL_PRIORITIES = [
  "must_have",
  "should_have",
  "nice_to_have",
] as RequirementPriority[];

export function RequirementsMatrix({
  requirements,
  manualIds,
  onDelete,
  onDetect,
}: Props) {
  const [filterCategory, setFilterCategory] = useState<
    RequirementCategory | "all"
  >("all");
  const [filterPriority, setFilterPriority] = useState<
    RequirementPriority | "all"
  >("all");

  const grouped = useMemo(() => {
    const filtered = requirements.filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory)
        return false;
      if (filterPriority !== "all" && r.priority !== filterPriority)
        return false;
      return true;
    });

    const byCategory: Partial<Record<RequirementCategory, Requirement[]>> = {};
    for (const r of filtered) {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category]!.push(r);
    }
    return byCategory;
  }, [requirements, filterCategory, filterPriority]);

  const categoriesWithResults = ALL_CATEGORIES.filter(
    (c) => grouped[c]?.length,
  );
  const mustHaveCount = requirements.filter(
    (r) => r.priority === "must_have",
  ).length;
  const needsValidationCount = requirements.filter(
    (r) => r.status === "needs_validation",
  ).length;

  if (requirements.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No requirements yet"
        body="Requirements auto-generate from your workflows, systems, and discovery notes. Add data to those tabs and they'll appear here with an evidence trail back to the source."
        cta={
          onDetect ? (
            <button
              type="button"
              onClick={onDetect}
              className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
            >
              Run requirement detection now
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{requirements.length} total requirements</span>
        <span>·</span>
        <span className="text-red-700">{mustHaveCount} must-haves</span>
        {needsValidationCount > 0 && (
          <>
            <span>·</span>
            <span className="text-orange-700">
              {needsValidationCount} need validation
            </span>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategory("all")}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            filterCategory === "all"
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All categories
        </button>
        {ALL_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCategory(c)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              filterCategory === c
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilterPriority("all")}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            filterPriority === "all"
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All priorities
        </button>
        {ALL_PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilterPriority(p)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              filterPriority === p
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p === "must_have"
              ? "Must Have"
              : p === "should_have"
                ? "Should Have"
                : "Nice to Have"}
          </button>
        ))}
      </div>

      {/* Grouped requirements */}
      {categoriesWithResults.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No requirements match the selected filters.
        </p>
      )}
      {categoriesWithResults.map((category) => (
        <section key={category} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
            {CATEGORY_LABELS[category]}{" "}
            <span className="font-normal">({grouped[category]!.length})</span>
          </h3>
          <div className="space-y-2">
            {grouped[category]!.map((req) => {
              const isManual = manualIds?.has(req.id);
              const priorityLabel =
                req.priority === "must_have"
                  ? "Must Have"
                  : req.priority === "should_have"
                    ? "Should Have"
                    : "Nice to Have";
              const statusLabel =
                req.status === "needs_validation"
                  ? "Needs Validation"
                  : req.status.charAt(0).toUpperCase() + req.status.slice(1);
              return (
                <Surface
                  key={req.id}
                  className={cn(
                    "px-4 py-3 space-y-1.5",
                    isManual && "border-primary/30",
                  )}
                >
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium flex-1 min-w-0 inline-flex items-center gap-1.5">
                      <span>{req.title}</span>
                      {req.rationale && (
                        <ProvenancePopover rationale={req.rationale} />
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isManual && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          Custom
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-xs", PRIORITY_COLORS[req.priority])}
                      >
                        {priorityLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", STATUS_COLORS[req.status])}
                      >
                        {statusLabel}
                      </Badge>
                      {isManual && onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(req.id)}
                          className="text-xs text-destructive/60 hover:text-destructive ml-1 transition-colors"
                          title="Remove requirement"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {req.description}
                  </p>
                  <EvidenceTrail refs={req.sourceRefs} />
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>
                      Owner: <span className="capitalize">{req.owner}</span>
                    </span>
                    <span>·</span>
                    <span>
                      Source:{" "}
                      <span className="capitalize">
                        {req.source.replace(/_/g, " ")}
                      </span>
                    </span>
                  </div>
                </Surface>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
