"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { FormField, ChipInput } from "@/components/ui/form-field";
import { Surface } from "@/components/ui/surface";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { cn, generateId } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { NotesDiffPanel, type RowId } from "@/components/NotesDiffPanel";
import type {
  DiscoverySession,
  ActionItem,
  ActionItemUrgency,
  NotesExtractionResult,
  SystemType,
  DataType,
  DataFormat,
  Frequency,
  ManualEffort,
  RiskCategory,
  RiskSeverity,
  RiskLikelihood,
  WorkflowStep,
  CustomerSystem,
  DataSource,
  DeploymentRisk,
  Stakeholder,
  OnboardingProject,
} from "@/lib/types";
import { useWorkspace } from "@/components/WorkspaceProvider";

// ── Enum sanitisers (same shape as NotesImport's) ─────────────────────────

const SYSTEM_TYPES: SystemType[] = [
  "crm",
  "case_management",
  "document_management",
  "data_warehouse",
  "ticketing",
  "email",
  "chat",
  "core_system",
  "custom",
  "other",
];
const DATA_TYPES: DataType[] = [
  "documents",
  "tickets",
  "customer_records",
  "transactions",
  "contracts",
  "messages",
  "logs",
  "other",
];
const DATA_FORMATS: DataFormat[] = [
  "pdf",
  "docx",
  "csv",
  "xlsx",
  "json",
  "api",
  "database",
  "mixed",
  "unknown",
];
const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "ad_hoc"];
const MANUAL_EFFORTS: ManualEffort[] = ["low", "medium", "high"];
const RISK_CATEGORIES: RiskCategory[] = [
  "data_readiness",
  "integration",
  "security",
  "stakeholder_alignment",
  "operational_adoption",
  "model_quality",
  "timeline",
  "legal_procurement",
  "support_readiness",
];
const RISK_SEVERITIES: RiskSeverity[] = ["critical", "high", "medium", "low"];
const RISK_LIKELIHOODS: RiskLikelihood[] = ["high", "medium", "low"];
const URGENCIES: ActionItemUrgency[] = ["high", "medium", "low"];

function pick<T extends string>(
  value: string | undefined,
  options: T[],
  fallback: T,
): T {
  if (!value) return fallback;
  const v = value.toLowerCase().replace(/\s+/g, "_");
  return (options as string[]).includes(v) ? (v as T) : fallback;
}

type Props = {
  session: DiscoverySession;
  defaultOpen?: boolean;
  onChange: (next: DiscoverySession) => void;
  onDelete: () => void;
};

type ExtractStep = "idle" | "reading" | "calling" | "mapping" | "done";

export function SessionEditor({
  session,
  defaultOpen = false,
  onChange,
  onDelete,
}: Props) {
  const { project, updateProject } = useWorkspace();
  const [open, setOpen] = useState(defaultOpen || !session.notes);
  const [extractStep, setExtractStep] = useState<ExtractStep>("idle");
  const extracting = extractStep !== "idle" && extractStep !== "done";
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NotesExtractionResult | null>(
    null,
  );
  const [lastApplied, setLastApplied] = useState<string[] | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: DiscoverySession) => {
      onChange(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [onChange],
  );

  // ── Field setters ───────────────────────────────────────────────────────
  // Standardised debounce: 400ms across all editors. Matches the default in
  // useFieldFlash so the "Saved" caption appears the moment persist commits.
  const setField = <K extends keyof DiscoverySession>(
    key: K,
    value: DiscoverySession[K],
  ) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(
      () => persist({ ...session, [key]: value }),
      400,
    );
  };

  // Local state for inputs that need immediate feedback (date, title, notes)
  // mirrors session and writes back via setField.
  const [titleDraft, setTitleDraft] = useState(session.title);
  const [dateDraft, setDateDraft] = useState(session.date);
  const [notesDraft, setNotesDraft] = useState(session.notes);

  // Attendee suggestions come from the project's stakeholders.
  const stakeholderNames =
    project?.stakeholders.map((s) => s.name).filter(Boolean) ?? [];

  const handleExtract = async () => {
    if (notesDraft.trim().length < 20) return;
    setExtractStep("reading");
    setError(null);
    setSuggestions(null);
    setLastApplied(null);

    try {
      setExtractStep("calling");
      const res = await fetch("/api/extract/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const data = await res.json();
      if (data.error === "no_api_key") {
        setError(
          "AI extraction requires an OpenAI API key. Notes are saved and used in artifact generation.",
        );
        toast.info(
          "AI extraction needs an API key — notes saved as plain text",
        );
        setExtractStep("idle");
        return;
      }
      if (data.error) {
        const detail =
          typeof data.message === "string" ? data.message : String(data.error);
        setError(`Extraction failed: ${detail}`);
        toast.error("Extraction failed", { description: detail });
        setExtractStep("idle");
        return;
      }
      setExtractStep("mapping");
      setSuggestions(data.suggestions as NotesExtractionResult);
      // Stamp extractedAt so SessionLog can show "extracted X ago".
      onChange({
        ...session,
        notes: notesDraft,
        extractedAt: new Date().toISOString(),
      });
      const s = data.suggestions as NotesExtractionResult;
      const hits =
        (s.suggestedWorkflows?.length ?? 0) +
        (s.suggestedSystems?.length ?? 0) +
        (s.suggestedDataSources?.length ?? 0) +
        (s.suggestedRisks?.length ?? 0) +
        (s.suggestedStakeholders?.length ?? 0) +
        (s.suggestedActionItems?.length ?? 0);
      toast.success(`Extracted ${hits} suggestion${hits !== 1 ? "s" : ""}`, {
        description: "Review and click Apply all to add them",
      });
      setExtractStep("done");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setError(`Network error: ${detail}`);
      toast.error("Network error", { description: detail });
      setExtractStep("idle");
    }
  };

  const handleApplySelected = useCallback(
    (selected: Set<RowId>) => {
      if (!suggestions || !project) return;
      const applied: string[] = [];
      const isPicked = (id: RowId) => selected.has(id);

      // Patch built up across the apply phases — single updateProject() call.
      const patch: Partial<OnboardingProject> = {};

      // ── Discovery fields + customer profile ────────────────────────────
      if (suggestions.discovery) {
        const customerPatch: Record<string, unknown> = {};
        const discoveryPatch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(suggestions.discovery)) {
          if (!isPicked(`discovery:${key}` as RowId)) continue;
          if (Array.isArray(value) ? value.length === 0 : !value) continue;
          if (
            key === "businessProblem" ||
            key === "primaryUseCase" ||
            key === "desiredOutcome"
          ) {
            customerPatch[key] = value;
            applied.push(`Customer · ${key}`);
          } else if (key === "regulatoryContext" && Array.isArray(value)) {
            customerPatch.regulatoryContext = Array.from(
              new Set([
                ...(project.customer.regulatoryContext ?? []),
                ...(value as string[]),
              ]),
            );
            applied.push(
              `${value.length} regulatory tag${value.length !== 1 ? "s" : ""}`,
            );
          } else {
            discoveryPatch[key] = value;
            applied.push(`Discovery · ${key}`);
          }
        }
        if (Object.keys(customerPatch).length > 0) {
          patch.customer = { ...project.customer, ...customerPatch };
        }
        if (Object.keys(discoveryPatch).length > 0) {
          patch.discovery = { ...project.discovery, ...discoveryPatch };
        }
      }

      // ── Stakeholders ───────────────────────────────────────────────────
      const existingStakeholderNames = new Set(
        project.stakeholders.map((s) => s.name.toLowerCase()),
      );
      const newStakeholders: Stakeholder[] = (
        suggestions.suggestedStakeholders ?? []
      )
        .map((s, idx) => ({ s, idx }))
        .filter(
          ({ s, idx }) =>
            isPicked(`stakeholder:${idx}` as RowId) &&
            !existingStakeholderNames.has(s.name.toLowerCase()),
        )
        .map(({ s }) => ({
          id: generateId(),
          name: s.name,
          role: s.role,
          team: s.team,
          influence: "medium",
          involvement: "end_user",
          concerns: s.concerns ?? [],
          requiredActions: [],
        }));
      if (newStakeholders.length > 0) {
        patch.stakeholders = [...project.stakeholders, ...newStakeholders];
        applied.push(
          `${newStakeholders.length} stakeholder${newStakeholders.length !== 1 ? "s" : ""}`,
        );
      }

      // ── Workflows ───────────────────────────────────────────────────────
      const existingWfNames = new Set(
        project.workflows.map((w) => w.name.toLowerCase()),
      );
      const newWorkflows: WorkflowStep[] = (
        suggestions.suggestedWorkflows ?? []
      )
        .map((w, idx) => ({ w, idx }))
        .filter(
          ({ w, idx }) =>
            isPicked(`workflow:${idx}` as RowId) &&
            !existingWfNames.has(w.name.toLowerCase()),
        )
        .map(({ w }) => ({
          id: generateId(),
          name: w.name,
          description: w.description,
          ownerTeam: w.ownerTeam,
          currentSystem: "",
          inputData: [],
          outputArtifact: [],
          painPoints: w.painPoints ?? [],
          manualEffort: pick<ManualEffort>(
            w.manualEffort,
            MANUAL_EFFORTS,
            "medium",
          ),
          frequency: pick<Frequency>(w.frequency, FREQUENCIES, "ad_hoc"),
          failureModes: [],
          automationPotential: "medium",
          futureState: "ai_assisted",
        }));
      if (newWorkflows.length > 0) {
        patch.workflows = [...project.workflows, ...newWorkflows];
        applied.push(
          `${newWorkflows.length} workflow step${newWorkflows.length !== 1 ? "s" : ""}`,
        );
      }

      // ── Systems ─────────────────────────────────────────────────────────
      const existingSysNames = new Set(
        project.systems.map((s) => s.name.toLowerCase()),
      );
      const newSystems: CustomerSystem[] = (suggestions.suggestedSystems ?? [])
        .map((s, idx) => ({ s, idx }))
        .filter(
          ({ s, idx }) =>
            isPicked(`system:${idx}` as RowId) &&
            !existingSysNames.has(s.name.toLowerCase()),
        )
        .map(({ s }) => ({
          id: generateId(),
          name: s.name,
          type: pick<SystemType>(s.type, SYSTEM_TYPES, "other"),
          owner: "",
          accessMethod: "unknown",
          apiAvailable: "unknown",
          authenticationMethod: "",
          dataSensitivity: "low",
          integrationComplexity: "medium",
          notes: s.notes ?? "",
        }));
      if (newSystems.length > 0) {
        patch.systems = [...project.systems, ...newSystems];
        applied.push(
          `${newSystems.length} system${newSystems.length !== 1 ? "s" : ""}`,
        );
      }

      // ── Data sources ────────────────────────────────────────────────────
      const existingSrcNames = new Set(
        project.dataSources.map((d) => d.name.toLowerCase()),
      );
      const newSources: DataSource[] = (suggestions.suggestedDataSources ?? [])
        .map((d, idx) => ({ d, idx }))
        .filter(
          ({ d, idx }) =>
            isPicked(`dataSource:${idx}` as RowId) &&
            !existingSrcNames.has(d.name.toLowerCase()),
        )
        .map(({ d }) => ({
          id: generateId(),
          name: d.name,
          sourceSystem: "",
          dataType: pick<DataType>(d.dataType, DATA_TYPES, "other"),
          format: pick<DataFormat>(d.format, DATA_FORMATS, "unknown"),
          quality: "unknown",
          volumeEstimate: "",
          updateFrequency: "",
          pii: "unknown",
          accessStatus: "unknown",
          openQuestions: d.notes ? [d.notes] : [],
        }));
      if (newSources.length > 0) {
        patch.dataSources = [...project.dataSources, ...newSources];
        applied.push(
          `${newSources.length} data source${newSources.length !== 1 ? "s" : ""}`,
        );
      }

      // ── Risks ───────────────────────────────────────────────────────────
      const existingRiskTitles = new Set(
        project.risks.map((r) => r.title.toLowerCase()),
      );
      const newRisks: DeploymentRisk[] = (suggestions.suggestedRisks ?? [])
        .map((rk, idx) => ({ rk, idx }))
        .filter(
          ({ rk, idx }) =>
            isPicked(`risk:${idx}` as RowId) &&
            !existingRiskTitles.has(rk.title.toLowerCase()),
        )
        .map(({ rk }) => ({
          id: generateId(),
          title: rk.title,
          description: rk.description,
          category: pick<RiskCategory>(
            rk.category,
            RISK_CATEGORIES,
            "operational_adoption",
          ),
          severity: pick<RiskSeverity>(rk.severity, RISK_SEVERITIES, "medium"),
          likelihood: pick<RiskLikelihood>(
            rk.likelihood,
            RISK_LIKELIHOODS,
            "medium",
          ),
          owner: "",
          mitigation: rk.mitigation ?? "",
          escalationTrigger: "",
          status: "open",
          source: "manual",
          sourceRefs: [
            {
              type: "session",
              refId: session.id,
              label: session.title || "Discovery session",
            },
          ],
        }));
      if (newRisks.length > 0) {
        patch.risks = [...project.risks, ...newRisks];
        applied.push(
          `${newRisks.length} risk${newRisks.length !== 1 ? "s" : ""}`,
        );
      }

      // ── Action items — attached to the session, not the project ────────
      const existingItemTitles = new Set(
        session.actionItems.map((a) => a.title.toLowerCase()),
      );
      const newActionItems: ActionItem[] = (
        suggestions.suggestedActionItems ?? []
      )
        .map((a, idx) => ({ a, idx }))
        .filter(
          ({ a, idx }) =>
            isPicked(`actionItem:${idx}` as RowId) &&
            !existingItemTitles.has(a.title.toLowerCase()),
        )
        .map(({ a }) => ({
          id: generateId(),
          title: a.title,
          assignee: a.assignee || "Unassigned",
          dueDate: a.dueDate,
          urgency: pick<ActionItemUrgency>(a.urgency, URGENCIES, "medium"),
          status: "open" as const,
          sessionId: session.id,
          createdAt: new Date().toISOString(),
        }));
      if (newActionItems.length > 0) {
        applied.push(
          `${newActionItems.length} action item${newActionItems.length !== 1 ? "s" : ""}`,
        );
        onChange({
          ...session,
          actionItems: [...session.actionItems, ...newActionItems],
        });
      }

      if (Object.keys(patch).length > 0) {
        updateProject(patch);
      }

      setLastApplied(applied);
      setSuggestions(null);
      if (applied.length > 0) {
        toast.success("Applied to project", {
          description: applied.join(" · "),
        });
      }
    },
    [suggestions, project, session, onChange, updateProject],
  );

  // ── Manual action item ops on this session ─────────────────────────────
  const addActionItem = () => {
    onChange({
      ...session,
      actionItems: [
        ...session.actionItems,
        {
          id: generateId(),
          title: "",
          assignee: "",
          urgency: "medium",
          status: "open",
          sessionId: session.id,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  };

  return (
    <Surface>
      {/* Header — date + title + collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="text-[11px] text-muted-foreground font-mono shrink-0 w-24">
          {session.date || "—"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {session.title || (
              <span className="text-muted-foreground italic">
                Untitled session
              </span>
            )}
          </p>
          {session.attendees.length > 0 && (
            <p className="text-[11px] text-muted-foreground truncate">
              {session.attendees.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px]">
          {session.notes && (
            <span className="text-muted-foreground">
              {session.notes.length.toLocaleString()} chars
            </span>
          )}
          {session.actionItems.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
              {session.actionItems.length} action
              {session.actionItems.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-muted-foreground">{open ? "↑" : "↓"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {/* Meta — date / title / attendees */}
          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="Date" helper="When the session happened.">
              <Input
                type="date"
                value={dateDraft}
                onChange={(e) => {
                  setDateDraft(e.target.value);
                  setField("date", e.target.value);
                }}
              />
            </FormField>
            <FormField
              label="Session title"
              helper="A short label so you can find it later."
            >
              <Input
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  setField("title", e.target.value);
                }}
                placeholder="e.g. Initial discovery call"
              />
            </FormField>
          </div>

          <FormField
            label="Attendees"
            helper="Press Enter to add each. Suggestions pulled from your Stakeholders."
          >
            <ChipInput
              value={session.attendees}
              onChange={(v) => onChange({ ...session, attendees: v })}
              placeholder="Type an attendee name…"
              suggestions={stakeholderNames}
              ariaLabel="Attendees"
            />
          </FormField>

          {/* Notes */}
          <FormField
            label="Raw notes"
            helper="Paste your raw notes, transcript, or shared document. AI extracts structured data + action items."
          >
            <div className="space-y-1.5">
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={8}
                value={notesDraft}
                onChange={(e) => {
                  setNotesDraft(e.target.value);
                  setField("notes", e.target.value);
                }}
                placeholder={
                  "Paste meeting notes, transcript, customer brief, or email thread…"
                }
              />
              <div className="flex items-center justify-end">
                <VoiceInputButton
                  label="Speak instead"
                  onTranscript={(text) => {
                    const next = notesDraft ? `${notesDraft} ${text}` : text;
                    setNotesDraft(next);
                    setField("notes", next);
                  }}
                />
              </div>
            </div>
          </FormField>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || notesDraft.trim().length < 20}
              className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {extracting ? "Extracting…" : "Extract & populate"}
            </button>
            {extracting && (
              <ExtractProgressPill
                step={extractStep}
                bytes={notesDraft.length}
              />
            )}
            {saved && !extracting && (
              <span className="text-xs text-muted-foreground">Saved ✓</span>
            )}
            {session.extractedAt && !extracting && (
              <span className="text-[11px] text-muted-foreground/70 ml-auto">
                Last extracted {new Date(session.extractedAt).toLocaleString()}
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              {error}
            </div>
          )}

          {lastApplied && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">
              <p className="font-medium">✓ Applied to project</p>
              {lastApplied.length > 0 && (
                <p className="text-xs text-emerald-800/90 mt-0.5">
                  {lastApplied.join(" · ")}
                </p>
              )}
            </div>
          )}

          {suggestions && project && (
            <NotesDiffPanel
              suggestions={suggestions}
              project={project}
              onCancel={() => setSuggestions(null)}
              onApply={handleApplySelected}
            />
          )}

          {/* Action items section (per-session, always visible) */}
          <ActionItemsSection
            session={session}
            onChange={onChange}
            onAdd={addActionItem}
          />

          <div className="pt-2 border-t flex items-center justify-between">
            <Link
              href={`/workspace/${project?.id ?? ""}/discovery`}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline"
            >
              Review applied data in Discovery →
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-destructive/70 hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
            >
              Delete session
            </button>
          </div>
        </div>
      )}
    </Surface>
  );
}

// ── Small subcomponents ───────────────────────────────────────────────────

function SuggestionSummary({
  suggestions,
}: {
  suggestions: NotesExtractionResult;
}) {
  const tally: { label: string; count: number }[] = [
    {
      label: "discovery fields",
      count: suggestions.discovery
        ? Object.keys(suggestions.discovery).filter(
            (k) =>
              suggestions.discovery![k as keyof typeof suggestions.discovery],
          ).length
        : 0,
    },
    {
      label: "stakeholders",
      count: suggestions.suggestedStakeholders?.length ?? 0,
    },
    { label: "workflows", count: suggestions.suggestedWorkflows?.length ?? 0 },
    { label: "systems", count: suggestions.suggestedSystems?.length ?? 0 },
    {
      label: "data sources",
      count: suggestions.suggestedDataSources?.length ?? 0,
    },
    { label: "risks", count: suggestions.suggestedRisks?.length ?? 0 },
    {
      label: "action items",
      count: suggestions.suggestedActionItems?.length ?? 0,
    },
  ].filter((t) => t.count > 0);
  if (tally.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No new data extracted from these notes.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tally.map((t) => (
        <span
          key={t.label}
          className="text-[11px] bg-background border rounded px-2 py-0.5"
        >
          <span className="font-semibold">{t.count}</span> {t.label}
        </span>
      ))}
    </div>
  );
}

function ActionItemsSection({
  session,
  onChange,
  onAdd,
}: {
  session: DiscoverySession;
  onChange: (next: DiscoverySession) => void;
  onAdd: () => void;
}) {
  const update = (id: string, patch: Partial<ActionItem>) => {
    onChange({
      ...session,
      actionItems: session.actionItems.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    });
  };
  const remove = (id: string) => {
    onChange({
      ...session,
      actionItems: session.actionItems.filter((a) => a.id !== id),
    });
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Action items{" "}
          <span className="ml-1 text-muted-foreground/60">
            ({session.actionItems.length})
          </span>
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 hover:no-underline"
        >
          + Add manually
        </button>
      </div>
      {session.actionItems.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          No action items yet. Extract notes or add one manually.
        </p>
      ) : (
        <div className="space-y-1.5">
          {session.actionItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
            >
              <input
                type="checkbox"
                checked={item.status === "done"}
                onChange={(e) =>
                  update(item.id, {
                    status: e.target.checked ? "done" : "open",
                  })
                }
                className="shrink-0"
                aria-label={`Mark ${item.title} as ${item.status === "done" ? "open" : "done"}`}
              />
              <Input
                value={item.title}
                onChange={(e) => update(item.id, { title: e.target.value })}
                placeholder="Action item title"
                className={cn(
                  "h-7 text-xs flex-1",
                  item.status === "done" &&
                    "line-through text-muted-foreground",
                )}
              />
              <Input
                value={item.assignee}
                onChange={(e) => update(item.id, { assignee: e.target.value })}
                placeholder="Owner"
                className="h-7 text-xs w-32 shrink-0"
              />
              <Input
                type="text"
                value={item.dueDate ?? ""}
                onChange={(e) => update(item.id, { dueDate: e.target.value })}
                placeholder="Due"
                className="h-7 text-xs w-24 shrink-0"
              />
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-destructive/60 hover:text-destructive text-xs px-1.5 shrink-0"
                aria-label="Remove action item"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExtractProgressPill({
  step,
  bytes,
}: {
  step: ExtractStep;
  bytes: number;
}) {
  const steps: { id: ExtractStep; label: string }[] = [
    { id: "reading", label: `Reading ${bytes.toLocaleString()} chars` },
    { id: "calling", label: "Calling OpenAI" },
    { id: "mapping", label: "Mapping to schema" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {steps.map((s, i) => {
        const done = activeIndex > i;
        const active = activeIndex === i;
        return (
          <span key={s.id} className="inline-flex items-center gap-1">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                done
                  ? "bg-emerald-500"
                  : active
                    ? "bg-amber-500 animate-pulse"
                    : "bg-muted-foreground/30",
              )}
              aria-hidden
            />
            <span className={cn(active && "text-foreground font-medium")}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground/40">·</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
