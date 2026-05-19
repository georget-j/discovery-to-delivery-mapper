"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, generateId } from "@/lib/utils";
import { detectMissingInfo } from "@/lib/missing-info-engine";
import { JourneyOverview } from "@/components/JourneyOverview";
import { DataFlowDiagram } from "@/components/DataFlowDiagram";
import type {
  MissingInfoItem,
  MissingInfoOwner,
  NotesExtractionResult,
  SystemType,
} from "@/lib/types";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const OWNER_CONFIG: Record<MissingInfoOwner, { label: string; dot: string }> = {
  customer:    { label: "Customer",    dot: "bg-blue-500" },
  engineering: { label: "Engineering", dot: "bg-purple-500" },
  security:    { label: "Security",    dot: "bg-red-500" },
  commercial:  { label: "Commercial",  dot: "bg-amber-500" },
  product:     { label: "Product",     dot: "bg-green-500" },
  unknown:     { label: "TBD",         dot: "bg-muted-foreground" },
};

const TAB_LABELS: Record<string, string> = {
  discovery: "Discovery",
  workflow:  "Workflow",
  systems:   "Systems & Data",
  pilot:     "Pilot Plan",
};

const VALID_SYSTEM_TYPES: SystemType[] = [
  "crm", "case_management", "document_management", "data_warehouse",
  "ticketing", "email", "chat", "core_system", "custom", "other",
];

function toSystemType(s: string): SystemType {
  return (VALID_SYSTEM_TYPES as string[]).includes(s) ? (s as SystemType) : "other";
}

// ── Open Actions Panel ────────────────────────────────────────────────────

function OpenActionsPanel({ items, projectId }: { items: MissingInfoItem[]; projectId: string }) {
  const [open, setOpen] = useState(false);

  const grouped = (Object.keys(OWNER_CONFIG) as MissingInfoOwner[]).reduce<Record<string, MissingInfoItem[]>>(
    (acc, owner) => {
      const ownerItems = items.filter((i) => i.suggestedOwner === owner);
      if (ownerItems.length > 0) acc[owner] = ownerItems;
      return acc;
    },
    {}
  );

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
          {items.length} open action{items.length !== 1 ? "s" : ""} — review before pilot launch
        </span>
        <span className="ml-auto text-amber-700/60 text-xs">{open ? "Hide ↑" : "Review ↓"}</span>
      </button>

      {open && (
        <div className="rounded-lg border bg-background divide-y">
          {Object.entries(grouped).map(([owner, ownerItems]) => {
            const config = OWNER_CONFIG[owner as MissingInfoOwner];
            return (
              <div key={owner} className="px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", config.dot)} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {config.label}
                  </span>
                </div>
                {ownerItems.map((action) => (
                  <div key={action.id} className="flex items-start gap-3 pl-4">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium leading-snug">{action.item}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{action.whyItMatters}</p>
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
        </div>
      )}
    </div>
  );
}

// ── Notes Card ────────────────────────────────────────────────────────────

const DISCOVERY_FIELD_LABELS: Record<string, string> = {
  businessProblem:        "Business Problem",
  primaryUseCase:         "Primary Use Case",
  desiredOutcome:         "Desired Outcome",
  currentProcess:         "Current Process",
  successDefinition:      "Success Definition",
  implementationDeadline: "Implementation Deadline",
  buyerTeam:              "Buyer Team",
  constraints:            "Constraints",
};

function NotesCard({
  projectId,
  initialNotes,
  onApply,
}: {
  projectId: string;
  initialNotes: string;
  onApply: (result: NotesExtractionResult) => void;
}) {
  const [open, setOpen] = useState(!!initialNotes);
  const [notes, setNotes] = useState(initialNotes);
  const [extracting, setExtracting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NotesExtractionResult | null>(null);
  const [applied, setApplied] = useState(false);
  const { updateProject } = useWorkspace();
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNotes = useCallback((value: string) => {
    updateProject({ meetingNotes: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [updateProject]);

  const handleChange = (value: string) => {
    setNotes(value);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => persistNotes(value), 1000);
  };

  const handleExtract = async () => {
    if (notes.trim().length < 20) return;
    setExtracting(true);
    setError(null);
    setSuggestions(null);
    setApplied(false);

    try {
      const res = await fetch("/api/extract/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();

      if (data.error === "no_api_key") {
        setError("Extraction requires an OpenAI API key. Notes are saved and will be included in artifact generation.");
        return;
      }
      if (data.error) {
        setError("Extraction failed — please try again or fill fields in manually.");
        return;
      }
      setSuggestions(data.suggestions as NotesExtractionResult);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleApplyAll = () => {
    if (!suggestions) return;
    onApply(suggestions);
    setApplied(true);
    setSuggestions(null);
  };

  const discoveryFields = suggestions?.discovery
    ? Object.entries(suggestions.discovery).filter(([, v]) => v && String(v).trim())
    : [];

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2">
          Notes & Context
          {initialNotes && (
            <span className="text-xs text-muted-foreground font-normal">(saved)</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste meeting notes, emails, or shared documentation. Notes are auto-saved and included in AI artifact generation. Use "Extract fields" to pre-populate structured data.
          </p>

          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={8}
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={"Paste meeting notes, discovery call transcript, customer brief, or shared documentation here…\n\nExample:\n- Met with Sarah Chen (CCO) and James Park (IT Director) on 14 May\n- Main problem: AML case triage takes 4 hours average, team of 12 analysts\n- Target: reduce to <45 minutes per case\n- Go-live target: Q3 2026\n- Key concern: regulatory explainability for SAR filing decisions"}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || notes.trim().length < 20}
              title={notes.trim().length < 20 ? "Add more notes to enable extraction" : ""}
              className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {extracting ? "Extracting…" : "Extract fields"}
            </button>
            {saved && <span className="text-xs text-muted-foreground">Saved ✓</span>}
          </div>

          {error && (
            <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
              {error}
            </div>
          )}

          {applied && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
              <span>✓ Fields applied — review in the</span>
              <Link href={`/workspace/${projectId}/discovery`} className="font-medium underline underline-offset-2 hover:no-underline">Discovery</Link>
              <span>and</span>
              <Link href={`/workspace/${projectId}/systems`} className="font-medium underline underline-offset-2 hover:no-underline">Systems</Link>
              <span>tabs.</span>
            </div>
          )}

          {suggestions && !applied && (
            <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extracted fields</p>
                  {suggestions.summary && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{suggestions.summary}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleApplyAll}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium shrink-0"
                >
                  Apply all to project
                </button>
              </div>

              <div className="space-y-2">
                {discoveryFields.map(([key, value]) => (
                  <div key={key} className="rounded-md bg-background border px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {DISCOVERY_FIELD_LABELS[key] ?? key}
                    </p>
                    <p className="text-sm mt-0.5 leading-snug">{String(value)}</p>
                  </div>
                ))}

                {(suggestions.suggestedStakeholders?.length ?? 0) > 0 && (
                  <div className="rounded-md bg-background border px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {suggestions.suggestedStakeholders!.length} stakeholder{suggestions.suggestedStakeholders!.length !== 1 ? "s" : ""} found
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {suggestions.suggestedStakeholders!.map((s, i) => (
                        <p key={i} className="text-sm">
                          {s.name} — {s.role}{s.team ? `, ${s.team}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {(suggestions.suggestedSystems?.length ?? 0) > 0 && (
                  <div className="rounded-md bg-background border px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {suggestions.suggestedSystems!.length} system{suggestions.suggestedSystems!.length !== 1 ? "s" : ""} mentioned
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {suggestions.suggestedSystems!.map((s, i) => (
                        <p key={i} className="text-sm">{s.name} ({s.type})</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export default function WorkspaceDashboard() {
  const { project, loading, updateProject } = useWorkspace();

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm">Loading workspace…</div>;
  }

  if (!project) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-muted-foreground">Scenario not found.</p>
        <Link href="/scenarios" className={buttonVariants({ variant: "outline", size: "sm" })}>
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

  const handleApplyExtraction = (result: NotesExtractionResult) => {
    const { businessProblem, primaryUseCase, desiredOutcome, ...discoveryPatch } = result.discovery ?? {};

    const customerPatch = (businessProblem || primaryUseCase || desiredOutcome)
      ? {
          customer: {
            ...project.customer,
            ...(businessProblem  ? { businessProblem }  : {}),
            ...(primaryUseCase   ? { primaryUseCase }   : {}),
            ...(desiredOutcome   ? { desiredOutcome }   : {}),
          },
        }
      : {};

    const discoveryUpdate = Object.keys(discoveryPatch).length > 0
      ? {
          discovery: {
            ...project.discovery,
            ...Object.fromEntries(Object.entries(discoveryPatch).filter(([, v]) => v)),
          },
        }
      : {};

    const existingStakeholderNames = new Set(project.stakeholders.map((s) => s.name.toLowerCase()));
    const newStakeholders = (result.suggestedStakeholders ?? [])
      .filter((s) => !existingStakeholderNames.has(s.name.toLowerCase()))
      .map((s) => ({
        id: generateId(),
        name: s.name,
        role: s.role,
        team: s.team,
        influence: "medium" as const,
        involvement: "end_user" as const,
        concerns: s.concerns ?? [],
        requiredActions: [],
      }));

    const existingSystemNames = new Set(project.systems.map((s) => s.name.toLowerCase()));
    const newSystems = (result.suggestedSystems ?? [])
      .filter((s) => !existingSystemNames.has(s.name.toLowerCase()))
      .map((s) => ({
        id: generateId(),
        name: s.name,
        type: toSystemType(s.type),
        owner: "",
        accessMethod: "unknown" as const,
        apiAvailable: "unknown" as const,
        authenticationMethod: "",
        dataSensitivity: "low" as const,
        integrationComplexity: "medium" as const,
        notes: s.notes ?? "",
      }));

    updateProject({
      ...customerPatch,
      ...discoveryUpdate,
      ...(newStakeholders.length > 0 ? { stakeholders: [...project.stakeholders, ...newStakeholders] } : {}),
      ...(newSystems.length > 0 ? { systems: [...project.systems, ...newSystems] } : {}),
    });
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs capitalize">{project.status}</Badge>
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

      {/* 4-phase journey hero */}
      <JourneyOverview />

      {/* How everything connects — data flow diagram */}
      <DataFlowDiagram />

      {/* Two-column: Open actions (left) + Key risks/quick stats (right) */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Open Actions</h2>
          <OpenActionsPanel items={missingInfo} projectId={project.id} />
        </section>

        <aside className="space-y-5">
          {topRisks.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key Risks</h2>
              <div className="rounded-lg border bg-background divide-y">
                {topRisks.map((risk) => (
                  <div key={risk.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                    <Badge variant="outline" className={cn("text-[10px] shrink-0 capitalize", SEVERITY_COLOR[risk.severity])}>
                      {risk.severity}
                    </Badge>
                    <span className="text-foreground text-xs leading-snug">{risk.title}</span>
                  </div>
                ))}
              </div>
              <Link href={`/workspace/${project.id}/risks`} className="text-xs text-muted-foreground hover:text-foreground transition-colors block">
                View all {project.risks.length} risks →
              </Link>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Project Stats</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Workflow Steps", value: project.workflows.length, href: "/workflow" },
                { label: "Systems",        value: project.systems.length, href: "/systems" },
                { label: "Data Sources",   value: project.dataSources.length, href: "/systems" },
                { label: "Stakeholders",   value: project.stakeholders.length, href: "/discovery" },
              ].map(({ label, value, href }) => (
                <Link
                  key={label}
                  href={`/workspace/${project.id}${href}`}
                  className="rounded-md border bg-background hover:bg-muted/30 transition-colors px-3 py-2 block"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-lg font-semibold">{value}</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Notes & Context */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes & Context</h2>
        <NotesCard
          projectId={project.id}
          initialNotes={project.meetingNotes ?? ""}
          onApply={handleApplyExtraction}
        />
      </section>
    </div>
  );
}
