"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn, generateId } from "@/lib/utils";
import type {
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
} from "@/lib/types";

// ── Enum sanitisers ──────────────────────────────────────────────────────────

const SYSTEM_TYPES: SystemType[] = ["crm", "case_management", "document_management", "data_warehouse", "ticketing", "email", "chat", "core_system", "custom", "other"];
const DATA_TYPES: DataType[] = ["documents", "tickets", "customer_records", "transactions", "contracts", "messages", "logs", "other"];
const DATA_FORMATS: DataFormat[] = ["pdf", "docx", "csv", "xlsx", "json", "api", "database", "mixed", "unknown"];
const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "ad_hoc"];
const MANUAL_EFFORTS: ManualEffort[] = ["low", "medium", "high"];
const RISK_CATEGORIES: RiskCategory[] = ["data_readiness", "integration", "security", "stakeholder_alignment", "operational_adoption", "model_quality", "timeline", "legal_procurement", "support_readiness"];
const RISK_SEVERITIES: RiskSeverity[] = ["critical", "high", "medium", "low"];
const RISK_LIKELIHOODS: RiskLikelihood[] = ["high", "medium", "low"];

function pick<T extends string>(value: string | undefined, options: T[], fallback: T): T {
  if (!value) return fallback;
  const v = value.toLowerCase().replace(/\s+/g, "_");
  return (options as string[]).includes(v) ? (v as T) : fallback;
}

// ── Phase grouping for extraction results ────────────────────────────────────

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

type PhaseColor = {
  bg: string; bgSubtle: string; border: string; text: string; accent: string;
};

const PHASE_COLORS: Record<string, PhaseColor> = {
  discover: { bg: "bg-blue-100",   bgSubtle: "bg-blue-50",   border: "border-blue-300",   text: "text-blue-700",   accent: "bg-blue-500"    },
  design:   { bg: "bg-violet-100", bgSubtle: "bg-violet-50", border: "border-violet-300", text: "text-violet-700", accent: "bg-violet-500"  },
  plan:     { bg: "bg-amber-100",  bgSubtle: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-700",  accent: "bg-amber-500"   },
};

function countDiscoverItems(r: NotesExtractionResult): number {
  let c = 0;
  if (r.discovery) {
    c += Object.keys(r.discovery).filter((k) => k !== "regulatoryContext" && r.discovery![k as keyof typeof r.discovery]).length;
    if (r.discovery.regulatoryContext?.length) c += 1;
  }
  if (r.suggestedStakeholders?.length) c += 1;
  return c;
}
function countDesignItems(r: NotesExtractionResult): number {
  return (r.suggestedWorkflows?.length ? 1 : 0)
       + (r.suggestedSystems?.length   ? 1 : 0)
       + (r.suggestedDataSources?.length ? 1 : 0);
}
function countPlanItems(r: NotesExtractionResult): number {
  return r.suggestedRisks?.length ? 1 : 0;
}

// ── Main component ──────────────────────────────────────────────────────────

export function NotesImport() {
  const { project, updateProject } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(project?.meetingNotes ?? "");
  const [extracting, setExtracting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NotesExtractionResult | null>(null);
  const [lastApplied, setLastApplied] = useState<string[] | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!project) return null;
  const projectId = project.id;
  const hasExistingNotes = !!project.meetingNotes;

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
    setLastApplied(null);

    try {
      const res = await fetch("/api/extract/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (data.error === "no_api_key") {
        setError("AI extraction requires an OpenAI API key. Your notes are saved and will still be included in the final artifact generation.");
        return;
      }
      if (data.error) {
        setError("Extraction failed. Please try again or fill the tabs manually.");
        return;
      }
      setSuggestions(data.suggestions as NotesExtractionResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  // ── Apply helpers (split by phase, so user can apply selectively) ─────────

  const applyDiscover = useCallback((r: NotesExtractionResult): string[] => {
    if (!project) return [];
    const applied: string[] = [];
    const { businessProblem, primaryUseCase, desiredOutcome, regulatoryContext, ...discoveryPatch } = r.discovery ?? {};

    const customerPatch =
      (businessProblem || primaryUseCase || desiredOutcome || (regulatoryContext && regulatoryContext.length))
        ? {
            customer: {
              ...project.customer,
              ...(businessProblem  ? { businessProblem }  : {}),
              ...(primaryUseCase   ? { primaryUseCase }   : {}),
              ...(desiredOutcome   ? { desiredOutcome }   : {}),
              ...(regulatoryContext && regulatoryContext.length
                ? { regulatoryContext: Array.from(new Set([...(project.customer.regulatoryContext ?? []), ...regulatoryContext])) }
                : {}),
            },
          }
        : {};
    if (businessProblem)      applied.push("Business problem");
    if (primaryUseCase)       applied.push("Primary use case");
    if (desiredOutcome)       applied.push("Desired outcome");
    if (regulatoryContext?.length) applied.push(`${regulatoryContext.length} regulatory tag${regulatoryContext.length !== 1 ? "s" : ""}`);

    const filteredDiscovery = Object.fromEntries(Object.entries(discoveryPatch).filter(([, v]) => v));
    const discoveryUpdate = Object.keys(filteredDiscovery).length > 0
      ? { discovery: { ...project.discovery, ...filteredDiscovery } }
      : {};
    Object.keys(filteredDiscovery).forEach((k) => applied.push(DISCOVERY_FIELD_LABELS[k] ?? k));

    const existingNames = new Set(project.stakeholders.map((s) => s.name.toLowerCase()));
    const newStakeholders: Stakeholder[] = (r.suggestedStakeholders ?? [])
      .filter((s) => !existingNames.has(s.name.toLowerCase()))
      .map((s) => ({
        id: generateId(),
        name: s.name,
        role: s.role,
        team: s.team,
        influence: "medium",
        involvement: "end_user",
        concerns: s.concerns ?? [],
        requiredActions: [],
      }));
    if (newStakeholders.length > 0) applied.push(`${newStakeholders.length} stakeholder${newStakeholders.length !== 1 ? "s" : ""}`);

    updateProject({
      ...customerPatch,
      ...discoveryUpdate,
      ...(newStakeholders.length > 0 ? { stakeholders: [...project.stakeholders, ...newStakeholders] } : {}),
    });
    return applied;
  }, [project, updateProject]);

  const applyDesign = useCallback((r: NotesExtractionResult): string[] => {
    if (!project) return [];
    const applied: string[] = [];

    const existingWfNames = new Set(project.workflows.map((w) => w.name.toLowerCase()));
    const newWorkflows: WorkflowStep[] = (r.suggestedWorkflows ?? [])
      .filter((w) => !existingWfNames.has(w.name.toLowerCase()))
      .map((w) => ({
        id: generateId(),
        name: w.name,
        description: w.description,
        ownerTeam: w.ownerTeam,
        currentSystem: "",
        inputData: [],
        outputArtifact: [],
        painPoints: w.painPoints ?? [],
        manualEffort: pick<ManualEffort>(w.manualEffort, MANUAL_EFFORTS, "medium"),
        frequency: pick<Frequency>(w.frequency, FREQUENCIES, "ad_hoc"),
        failureModes: [],
        automationPotential: "medium",
        futureState: "ai_assisted",
      }));
    if (newWorkflows.length > 0) applied.push(`${newWorkflows.length} workflow step${newWorkflows.length !== 1 ? "s" : ""}`);

    const existingSysNames = new Set(project.systems.map((s) => s.name.toLowerCase()));
    const newSystems: CustomerSystem[] = (r.suggestedSystems ?? [])
      .filter((s) => !existingSysNames.has(s.name.toLowerCase()))
      .map((s) => ({
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
    if (newSystems.length > 0) applied.push(`${newSystems.length} system${newSystems.length !== 1 ? "s" : ""}`);

    const existingSrcNames = new Set(project.dataSources.map((d) => d.name.toLowerCase()));
    const newSources: DataSource[] = (r.suggestedDataSources ?? [])
      .filter((d) => !existingSrcNames.has(d.name.toLowerCase()))
      .map((d) => ({
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
    if (newSources.length > 0) applied.push(`${newSources.length} data source${newSources.length !== 1 ? "s" : ""}`);

    updateProject({
      ...(newWorkflows.length > 0 ? { workflows: [...project.workflows, ...newWorkflows] } : {}),
      ...(newSystems.length > 0   ? { systems:   [...project.systems,   ...newSystems]   } : {}),
      ...(newSources.length > 0   ? { dataSources: [...project.dataSources, ...newSources] } : {}),
    });
    return applied;
  }, [project, updateProject]);

  const applyPlan = useCallback((r: NotesExtractionResult): string[] => {
    if (!project) return [];
    const applied: string[] = [];

    const existingRiskTitles = new Set(project.risks.map((r) => r.title.toLowerCase()));
    const newRisks: DeploymentRisk[] = (r.suggestedRisks ?? [])
      .filter((rk) => !existingRiskTitles.has(rk.title.toLowerCase()))
      .map((rk) => ({
        id: generateId(),
        title: rk.title,
        description: rk.description,
        category: pick<RiskCategory>(rk.category, RISK_CATEGORIES, "operational_adoption"),
        severity: pick<RiskSeverity>(rk.severity, RISK_SEVERITIES, "medium"),
        likelihood: pick<RiskLikelihood>(rk.likelihood, RISK_LIKELIHOODS, "medium"),
        owner: "",
        mitigation: rk.mitigation ?? "",
        escalationTrigger: "",
        status: "open",
        source: "manual",
      }));
    if (newRisks.length > 0) applied.push(`${newRisks.length} risk${newRisks.length !== 1 ? "s" : ""}`);

    if (newRisks.length > 0) {
      updateProject({ risks: [...project.risks, ...newRisks] });
    }
    return applied;
  }, [project, updateProject]);

  const handleApplyAll = useCallback(() => {
    if (!suggestions) return;
    const applied: string[] = [];
    applied.push(...applyDiscover(suggestions));
    applied.push(...applyDesign(suggestions));
    applied.push(...applyPlan(suggestions));
    setLastApplied(applied);
    setSuggestions(null);
  }, [suggestions, applyDiscover, applyDesign, applyPlan]);

  const handleApplyDiscover = useCallback(() => {
    if (!suggestions) return;
    setLastApplied(applyDiscover(suggestions));
  }, [suggestions, applyDiscover]);

  const handleApplyDesign = useCallback(() => {
    if (!suggestions) return;
    setLastApplied(applyDesign(suggestions));
  }, [suggestions, applyDesign]);

  const handleApplyPlan = useCallback(() => {
    if (!suggestions) return;
    setLastApplied(applyPlan(suggestions));
  }, [suggestions, applyPlan]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all px-6 py-5 text-left group"
      >
        <div className="flex items-start gap-4">
          <span className="text-3xl shrink-0">📝</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {hasExistingNotes ? "View saved notes & re-extract" : "Paste meeting notes or interviews to auto-populate the project"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              AI extracts discovery fields, stakeholders, workflows, systems, data sources, and risks — across all 4 phases. Review and apply per phase or all at once.
            </p>
            {hasExistingNotes && (
              <p className="text-[11px] text-muted-foreground/70 mt-2">
                {project.meetingNotes!.length.toLocaleString()} characters saved
              </p>
            )}
          </div>
          <span className="text-primary group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
        </div>
      </button>
    );
  }

  const counts = suggestions
    ? { discover: countDiscoverItems(suggestions), design: countDesignItems(suggestions), plan: countPlanItems(suggestions) }
    : { discover: 0, design: 0, plan: 0 };

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="text-sm font-semibold">Notes & Interview Import</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Paste raw notes → AI extracts structured project data</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
        >
          Collapse ↑
        </button>
      </div>

      <div className="p-4 space-y-4">
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          rows={10}
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={"Paste meeting notes, discovery call transcripts, shared customer documentation, or email threads…\n\nExample:\n- Met with Sarah Chen (CCO) and James Park (IT Director) on 14 May\n- Main problem: AML case triage takes 4 hours average, team of 12 analysts\n- Target: reduce to <45 minutes per case\n- Go-live target: Q3 2026\n- Key concern: regulatory explainability for SAR filing decisions\n- Systems mentioned: Actimize Case Manager, World-Check, Customer Profile DB\n- Risks raised: false negatives on real money laundering, GDPR for prompt context"}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || notes.trim().length < 20}
            title={notes.trim().length < 20 ? "Add more notes to enable extraction" : "Run AI extraction"}
            className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {extracting ? "Extracting…" : "Extract & populate"}
          </button>
          {saved && <span className="text-xs text-muted-foreground">Saved ✓</span>}
          <span className="text-[11px] text-muted-foreground/70 ml-auto">
            Notes are auto-saved as you type
          </span>
        </div>

        {error && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            {error}
          </div>
        )}

        {lastApplied && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-900 space-y-1">
            <p className="font-medium flex items-center gap-2">
              <span>✓ Applied to project</span>
              <span className="text-xs font-normal text-emerald-700/80">— review in each phase tab</span>
            </p>
            {lastApplied.length > 0 && (
              <p className="text-xs text-emerald-800/90 leading-relaxed">
                {lastApplied.join(" · ")}
              </p>
            )}
          </div>
        )}

        {suggestions && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extracted from notes</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 italic">{suggestions.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAll}
                  className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium shrink-0"
                >
                  Apply all to project →
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <PhaseSection
                phaseId="discover"
                phaseNumber={1}
                phaseLabel="Discover"
                itemCount={counts.discover}
                onApply={handleApplyDiscover}
                projectId={projectId}
                viewTab="discovery"
              >
                {suggestions.discovery && Object.entries(suggestions.discovery)
                  .filter(([k, v]) => k !== "regulatoryContext" && v && String(v).trim())
                  .map(([k, v]) => (
                    <ExtractedItem key={k} label={DISCOVERY_FIELD_LABELS[k] ?? k}>
                      {String(v)}
                    </ExtractedItem>
                  ))}
                {suggestions.discovery?.regulatoryContext?.length ? (
                  <ExtractedItem label="Regulatory">
                    {suggestions.discovery.regulatoryContext.join(", ")}
                  </ExtractedItem>
                ) : null}
                {suggestions.suggestedStakeholders?.length ? (
                  <ExtractedItem label={`${suggestions.suggestedStakeholders.length} stakeholder${suggestions.suggestedStakeholders.length !== 1 ? "s" : ""}`}>
                    {suggestions.suggestedStakeholders.map((s) => `${s.name} (${s.role})`).join(", ")}
                  </ExtractedItem>
                ) : null}
              </PhaseSection>

              <PhaseSection
                phaseId="design"
                phaseNumber={2}
                phaseLabel="Design"
                itemCount={counts.design}
                onApply={handleApplyDesign}
                projectId={projectId}
                viewTab="workflow"
              >
                {suggestions.suggestedWorkflows?.length ? (
                  <ExtractedItem label={`${suggestions.suggestedWorkflows.length} workflow step${suggestions.suggestedWorkflows.length !== 1 ? "s" : ""}`}>
                    {suggestions.suggestedWorkflows.map((w) => w.name).join(" → ")}
                  </ExtractedItem>
                ) : null}
                {suggestions.suggestedSystems?.length ? (
                  <ExtractedItem label={`${suggestions.suggestedSystems.length} system${suggestions.suggestedSystems.length !== 1 ? "s" : ""}`}>
                    {suggestions.suggestedSystems.map((s) => s.name).join(", ")}
                  </ExtractedItem>
                ) : null}
                {suggestions.suggestedDataSources?.length ? (
                  <ExtractedItem label={`${suggestions.suggestedDataSources.length} data source${suggestions.suggestedDataSources.length !== 1 ? "s" : ""}`}>
                    {suggestions.suggestedDataSources.map((d) => d.name).join(", ")}
                  </ExtractedItem>
                ) : null}
              </PhaseSection>

              <PhaseSection
                phaseId="plan"
                phaseNumber={3}
                phaseLabel="Plan"
                itemCount={counts.plan}
                onApply={handleApplyPlan}
                projectId={projectId}
                viewTab="risks"
              >
                {suggestions.suggestedRisks?.length ? (
                  <ExtractedItem label={`${suggestions.suggestedRisks.length} risk${suggestions.suggestedRisks.length !== 1 ? "s" : ""}`}>
                    {suggestions.suggestedRisks.map((r) => r.title).join(", ")}
                  </ExtractedItem>
                ) : null}
              </PhaseSection>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function PhaseSection({
  phaseId,
  phaseNumber,
  phaseLabel,
  itemCount,
  onApply,
  projectId,
  viewTab,
  children,
}: {
  phaseId: "discover" | "design" | "plan";
  phaseNumber: number;
  phaseLabel: string;
  itemCount: number;
  onApply: () => void;
  projectId: string;
  viewTab: string;
  children: React.ReactNode;
}) {
  const colors = PHASE_COLORS[phaseId];
  const hasItems = itemCount > 0;

  return (
    <div className={cn("rounded-lg border bg-background", hasItems ? colors.border : "border-border")}>
      <div className={cn("flex items-center justify-between px-3 py-2 border-b", hasItems ? colors.bgSubtle : "bg-muted/20")}>
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
            hasItems ? cn(colors.accent, "text-white") : "bg-muted text-muted-foreground"
          )}>
            {phaseNumber}
          </span>
          <p className={cn("text-xs font-bold uppercase tracking-wider", hasItems ? colors.text : "text-muted-foreground")}>
            {phaseLabel}
          </p>
        </div>
        {hasItems && (
          <button
            type="button"
            onClick={onApply}
            className={cn("text-[11px] px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80", colors.accent, "text-white")}
          >
            Apply
          </button>
        )}
      </div>
      <div className="p-3 space-y-2 text-xs">
        {hasItems ? (
          children
        ) : (
          <p className="text-muted-foreground italic">No {phaseLabel.toLowerCase()} items extracted.</p>
        )}
      </div>
      {hasItems && (
        <div className="px-3 pb-2">
          <Link
            href={`/workspace/${projectId}/${viewTab}`}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            View {phaseLabel.toLowerCase()} tab →
          </Link>
        </div>
      )}
    </div>
  );
}

function ExtractedItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs mt-0.5 leading-snug">{children}</p>
    </div>
  );
}
