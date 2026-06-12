"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { detectMissingInfo } from "@/lib/missing-info-engine";
import { JourneyOverview } from "@/components/JourneyOverview";
import { DataFlowDiagram } from "@/components/DataFlowDiagram";
import { SessionLog } from "@/components/SessionLog";
import { ActionItems } from "@/components/ActionItems";
import { EmptyState } from "@/components/ui/empty-state";
import type { MissingInfoItem, MissingInfoOwner } from "@/lib/types";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const OWNER_CONFIG: Record<MissingInfoOwner, { label: string; dot: string }> = {
  customer: { label: "Customer", dot: "bg-blue-500" },
  engineering: { label: "Engineering", dot: "bg-purple-500" },
  security: { label: "Security", dot: "bg-red-500" },
  commercial: { label: "Commercial", dot: "bg-amber-500" },
  product: { label: "Product", dot: "bg-green-500" },
  unknown: { label: "TBD", dot: "bg-muted-foreground" },
};

const TAB_LABELS: Record<string, string> = {
  discovery: "Discovery",
  workflow: "Workflow",
  systems: "Systems & Data",
  pilot: "Pilot Plan",
};

// ── Open Actions Panel ────────────────────────────────────────────────────

function OpenActionsPanel({
  items,
  projectId,
}: {
  items: MissingInfoItem[];
  projectId: string;
}) {
  const [open, setOpen] = useState(false);

  const grouped = (Object.keys(OWNER_CONFIG) as MissingInfoOwner[]).reduce<
    Record<string, MissingInfoItem[]>
  >((acc, owner) => {
    const ownerItems = items.filter((i) => i.suggestedOwner === owner);
    if (ownerItems.length > 0) acc[owner] = ownerItems;
    return acc;
  }, {});

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/50 px-4 py-3 text-sm text-green-800">
        <span>✓</span>
        <span className="font-medium">All actions resolved</span>
        <span className="text-green-700/70">— ready to generate outputs</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 text-sm text-left hover:bg-amber-50/70 transition-colors"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold shrink-0">
          {items.length}
        </span>
        <span className="font-medium text-amber-900">
          {items.length} open action{items.length !== 1 ? "s" : ""} — review
          before pilot launch
        </span>
        <span className="ml-auto text-amber-700/60 text-xs">
          {open ? "Hide ↑" : "Review ↓"}
        </span>
      </button>

      {open && (
        <Surface className="divide-y">
          {Object.entries(grouped).map(([owner, ownerItems]) => {
            const config = OWNER_CONFIG[owner as MissingInfoOwner];
            return (
              <div key={owner} className="px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn("w-2 h-2 rounded-full shrink-0", config.dot)}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {config.label}
                  </span>
                </div>
                {ownerItems.map((action) => (
                  <div key={action.id} className="flex items-start gap-3 pl-4">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium leading-snug">
                        {action.item}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {action.whyItMatters}
                      </p>
                    </div>
                    <Link
                      href={`/workspace/${projectId}/${action.relatedTab}`}
                      className="text-xs text-primary hover:text-primary/80 shrink-0 whitespace-nowrap pt-0.5 transition-colors"
                    >
                      → {TAB_LABELS[action.relatedTab]}
                    </Link>
                  </div>
                ))}
              </div>
            );
          })}
        </Surface>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function WorkspaceDashboard() {
  const { project, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="p-8 text-muted-foreground text-sm">
        Loading workspace…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-muted-foreground">Scenario not found.</p>
        <Link
          href="/scenarios"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Browse Scenarios
        </Link>
      </div>
    );
  }

  const topRisks = [...project.risks]
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    })
    .slice(0, 3);
  const missingInfo = detectMissingInfo(project);

  const kbEmpty = (project.knowledgeBase?.totalChunks ?? 0) === 0;

  // A project with nothing captured yet gets a getting-started block instead
  // of an "N open actions" blocker — those actions are noise before any input.
  const isBlank =
    kbEmpty &&
    !project.discovery.currentProcess &&
    project.workflows.length === 0 &&
    project.systems.length === 0 &&
    project.stakeholders.length === 0 &&
    project.risks.length === 0 &&
    (project.meetingSessions?.length ?? 0) === 0;

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      {kbEmpty && !isBlank && (
        <Surface
          variant="muted"
          className="px-4 py-3 flex items-center justify-between gap-3 border-primary/30 bg-primary/5"
        >
          <p className="text-sm text-muted-foreground">
            <span className="mr-1.5" aria-hidden>
              📎
            </span>
            Have customer docs? Drop them on Intake to auto-fill discovery,
            workflows, systems, and risks.
          </p>
          <Link
            href={`/workspace/${project.id}/intake`}
            className="text-xs font-medium text-primary hover:text-primary/80 shrink-0 whitespace-nowrap"
          >
            Add documents →
          </Link>
        </Surface>
      )}

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs capitalize">
            {project.status}
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">
            {project.customer.industry.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground capitalize">
            {project.customer.companySize.replace(/_/g, " ")}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{project.name}</h1>
        {project.customer.businessProblem && (
          <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
            {project.customer.businessProblem}
          </p>
        )}
      </div>

      {/* Truly-blank project: orient the user instead of listing blockers. */}
      {isBlank && (
        <EmptyState
          tone="prominent"
          icon="🧭"
          title="Start by adding what you know"
          body="Drop customer docs on Intake to auto-fill discovery, workflows, systems, and risks — or head to Discovery and capture it by hand."
          cta={
            <div className="flex items-center gap-2">
              <Link
                href={`/workspace/${project.id}/intake`}
                className={buttonVariants({ size: "sm" })}
              >
                Add documents
              </Link>
              <Link
                href={`/workspace/${project.id}/discovery`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Fill in manually
              </Link>
            </div>
          }
        />
      )}

      {/* Top blocker banner — single CTA so the user knows what to do next.
          Open actions take priority over phase-complete signals. */}
      {(() => {
        const openCount = missingInfo.length;
        if (isBlank) return null;
        if (openCount > 0) {
          return (
            <Surface
              variant="muted"
              className="px-4 py-3 flex items-center gap-3 border-amber-200 bg-amber-50/40"
            >
              <span
                className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                aria-hidden
              />
              <p className="text-sm flex-1">
                <span className="font-semibold">
                  {openCount} open action{openCount !== 1 ? "s" : ""}
                </span>{" "}
                worth resolving before the pilot — review them below.
              </p>
              <a
                href="#open-actions"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "shrink-0",
                )}
              >
                Resolve →
              </a>
            </Surface>
          );
        }
        return null;
      })()}

      {/* Discovery session log — multi-session capture, replaces the old single notes textarea */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Discovery Sessions
        </h2>
        <SessionLog />
      </section>

      {/* Aggregated action items extracted across all sessions */}
      <ActionItems />

      {/* 4-phase journey hero */}
      <JourneyOverview />

      {/* How everything connects — data flow diagram */}
      <DataFlowDiagram />

      {/* Two-column: Open actions (left) + Key risks/quick stats (right) */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section
          id="open-actions"
          className="lg:col-span-2 space-y-2 scroll-mt-20"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Open Actions
          </h2>
          <OpenActionsPanel items={missingInfo} projectId={project.id} />
        </section>

        <aside className="space-y-5">
          {topRisks.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Key Risks
              </h2>
              <Surface className="divide-y">
                {topRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="flex items-start gap-2 px-3 py-2 text-sm"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] shrink-0 capitalize",
                        SEVERITY_COLOR[risk.severity],
                      )}
                    >
                      {risk.severity}
                    </Badge>
                    <span className="text-foreground text-xs leading-snug">
                      {risk.title}
                    </span>
                  </div>
                ))}
              </Surface>
              <Link
                href={`/workspace/${project.id}/risks`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
              >
                View all {project.risks.length} risks →
              </Link>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Project Stats
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Workflow Steps",
                  value: project.workflows.length,
                  href: "/workflow",
                },
                {
                  label: "Systems",
                  value: project.systems.length,
                  href: "/systems",
                },
                {
                  label: "Data Sources",
                  value: project.dataSources.length,
                  href: "/systems",
                },
                {
                  label: "Stakeholders",
                  value: project.stakeholders.length,
                  href: "/discovery",
                },
              ].map(({ label, value, href }) => (
                <Link
                  key={label}
                  href={`/workspace/${project.id}${href}`}
                  className="rounded-md border bg-background hover:bg-muted/30 transition-colors px-3 py-2 block"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {label}
                  </p>
                  <p className="text-lg font-semibold">{value}</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
