"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ArtifactProse } from "@/components/outputs/ArtifactProse";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  assembleScopedPack,
  downloadMarkdown,
  type PackScope,
} from "@/lib/markdown-export";
import { downloadPackDocx } from "@/lib/export-docx";
import { PageNav } from "@/components/PageNav";
import { StaleArtifactsBanner } from "@/components/outputs/StaleArtifactsBanner";
import { ArtifactSourcesPanel } from "@/components/outputs/ArtifactSourcesPanel";
import { PackOverview } from "@/components/outputs/PackOverview";
import { Sheet } from "@/components/ui/sheet";
import { Modal } from "@/components/ui/modal";
import { ConfirmActionModal } from "@/components/visualisations/shared/ConfirmActionModal";
import type { GeneratedArtifacts, OnboardingProject } from "@/lib/types";
import {
  hashGenerationInputs,
  stripCitationMarkers,
} from "@/lib/artifact-helpers";
import { getArtifactReadiness, type ArtifactKey } from "@/lib/artifact-sources";
import {
  READINESS_DOT,
  READINESS_LABEL,
  readinessTooltip,
} from "@/lib/readiness";
import { assessGenerationReadiness } from "@/lib/generation-readiness";

type Tab = ArtifactKey;
type ViewMode = "overview" | "artifact";

type TabMeta = {
  key: Tab;
  label: string;
  audience: string;
  purpose: string;
};

type Group = {
  label: string;
  tabs: TabMeta[];
};

// Audience + purpose lines tightened per Track B style guide: specific role,
// outcome verb, concrete one-line purpose. No "alignment and buy-in" hedging.
const GROUPS: Group[] = [
  {
    label: "Customer-Facing",
    tabs: [
      {
        key: "executiveSummary",
        label: "Executive Summary",
        audience: "Customer C-suite",
        purpose: "Get sign-off on the deployment in one page",
      },
      {
        key: "futureStateWorkflow",
        label: "Future State Workflow",
        audience: "Customer + AI Lead",
        purpose: "Show exactly how AI fits into their workflow",
      },
      {
        key: "pilotSuccessPlan",
        label: "Pilot Success Plan",
        audience: "Customer + Sponsor",
        purpose: "Lock down what 'pilot success' means before kick-off",
      },
      {
        key: "stakeholderCommunicationPlan",
        label: "Comms Plan",
        audience: "CSM",
        purpose: "Decide who hears what, and how often",
      },
      {
        key: "nextActionsChecklist",
        label: "Next Actions",
        audience: "CSM + Customer",
        purpose: "End every meeting with named owners and dates",
      },
    ],
  },
  {
    label: "Internal",
    tabs: [
      {
        key: "customerDiscoverySummary",
        label: "Discovery Summary",
        audience: "Internal handoff",
        purpose: "Brief the deployment team in 5 minutes",
      },
      {
        key: "requirementsMatrix",
        label: "Requirements Matrix",
        audience: "Engineering",
        purpose: "Sign-off list before integration sprint",
      },
      {
        key: "missingInformationLog",
        label: "Missing Info Log",
        audience: "CSM + Customer",
        purpose: "Track every unresolved question with an owner",
      },
      {
        key: "riskRegisterSummary",
        label: "Risk Register Summary",
        audience: "Customer Exec",
        purpose: "Surface what could derail the pilot, with mitigation",
      },
      {
        key: "implementationPlan",
        label: "Implementation Plan",
        audience: "Customer + Internal",
        purpose: "Phase the work from kick-off to rollout",
      },
    ],
  },
  {
    label: "Technical",
    tabs: [
      {
        key: "currentStateWorkflow",
        label: "Current State Workflow",
        audience: "Eng + Product",
        purpose: "Baseline the process as it actually works today",
      },
      {
        key: "integrationAndApiPlan",
        label: "Integration & API Plan",
        audience: "Engineering",
        purpose: "Scope every integration, including the ones without APIs",
      },
      {
        key: "dataReadinessAssessment",
        label: "Data Readiness",
        audience: "Data + Eng",
        purpose: "Decide whether the data can carry the AI",
      },
      {
        key: "engineeringHandoff",
        label: "Engineering Handoff",
        audience: "Engineering",
        purpose: "Everything engineering needs on day one",
      },
    ],
  },
  {
    label: "Product",
    tabs: [
      {
        key: "productFeedbackMemo",
        label: "Product Feedback Memo",
        audience: "Product",
        purpose: "Capture what this engagement revealed about the product",
      },
    ],
  },
];

const ALL_TABS: TabMeta[] = GROUPS.flatMap((g) => g.tabs);
const ALL_TAB_KEYS = new Set<string>(ALL_TABS.map((t) => t.key));

// One level of regeneration undo. The outgoing outputs blob is parked in
// localStorage (outside the project blob, so updateProject stays a plain
// patch) and swapped back via "Restore previous generation".
const OUTPUTS_HISTORY_KEY = (projectId: string) =>
  `dtdm:outputs-history:${projectId}`;

function stashOutputsHistory(
  projectId: string,
  outputs: GeneratedArtifacts,
): void {
  try {
    localStorage.setItem(
      OUTPUTS_HISTORY_KEY(projectId),
      JSON.stringify(outputs),
    );
  } catch {
    /* quota exceeded — history is best-effort */
  }
}

function readOutputsHistory(projectId: string): GeneratedArtifacts | null {
  try {
    const raw = localStorage.getItem(OUTPUTS_HISTORY_KEY(projectId));
    return raw ? (JSON.parse(raw) as GeneratedArtifacts) : null;
  } catch {
    return null;
  }
}

// Shared by full regeneration and single-artifact regeneration: ground the
// prompt in the knowledge base when one exists, then call the generation
// endpoint. The endpoint always produces the full 15-artifact set; callers
// decide how much of it to merge.
async function fetchGeneration(project: OnboardingProject): Promise<{
  artifacts: GeneratedArtifacts;
  source: string;
}> {
  let kbContext: { id: string; text: string; label?: string }[] = [];
  if ((project.knowledgeBase?.totalChunks ?? 0) > 0) {
    try {
      const { retrieveForTarget } = await import("@/lib/kb/retrieve");
      const hits = await retrieveForTarget(project.id, "all", 12);
      kbContext = hits.map((h) => ({
        id: h.chunk.id,
        text: h.chunk.text,
        label: h.label,
      }));
    } catch {
      /* retrieval is best-effort; generation proceeds without it */
    }
  }
  const res = await fetch("/api/generate/artifacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      kbContext.length > 0 ? { project, kbContext } : project,
    ),
  });
  const data = await res.json();
  if (!data.artifacts) throw new Error(data.error ?? "no_artifacts");
  return {
    artifacts: data.artifacts as GeneratedArtifacts,
    source: data.source as string,
  };
}

export default function OutputsPage() {
  const { project, loading, updateProject } = useWorkspace();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("executiveSummary");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Sources panel is now a Sheet on all viewports — opens on chip click or via
  // an explicit "Sources" button in the artifact toolbar.
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Mobile-only: artifact picker also opens as a bottom Sheet.
  const [preflightOpen, setPreflightOpen] = useState(false);
  // Export menu (Markdown / PDF / Word) + audience scope for all three paths.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<PackScope>("full");
  // Per-artifact draft stash — keyed by artifact so switching tabs parks an
  // in-progress edit instead of destroying it; reopening the tab resumes it.
  const [drafts, setDrafts] = useState<Partial<Record<Tab, string>>>({});
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  // "Regenerate all" decision modal — shown when hand-edited artifacts exist.
  const [regenChoiceOpen, setRegenChoiceOpen] = useState(false);
  // Single-artifact regeneration in flight (drives the per-artifact spinner).
  const [regeneratingArtifact, setRegeneratingArtifact] = useState<Tab | null>(
    null,
  );
  // Whether a previous-generation blob exists for this project.
  const [historyAvailable, setHistoryAvailable] = useState(false);

  const draft = drafts[activeTab];
  const editing = draft !== undefined;
  const draftDirty = editing && draft !== (project?.outputs?.[activeTab] ?? "");

  // Deep-link from /outputs/matrix → ?artifact=KEY. Switch to that artifact
  // on mount, then drop the param via history.replaceState so it's a one-shot.
  useEffect(() => {
    const requested = searchParams.get("artifact");
    if (requested && ALL_TAB_KEYS.has(requested)) {
      setActiveTab(requested as Tab);
      setViewMode("artifact");
      // Strip the query so refreshing doesn't keep snapping you back.
      const url = new URL(window.location.href);
      url.searchParams.delete("artifact");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const openSources = useCallback(() => setSourcesOpen(true), []);

  // Browser refresh/close with an unsaved edit in flight gets the native
  // "leave site?" prompt. In-app tab switches are safe — drafts stay parked.
  const hasDirtyDraft = useMemo(
    () =>
      Object.entries(drafts).some(
        ([key, value]) =>
          value !== undefined &&
          value !== (project?.outputs?.[key as Tab] ?? ""),
      ),
    [drafts, project],
  );
  useEffect(() => {
    if (!hasDirtyDraft) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDirtyDraft]);

  // History lives in localStorage; sniff it whenever the project changes.
  useEffect(() => {
    if (!project?.id) return;
    setHistoryAvailable(readOutputsHistory(project.id) !== null);
  }, [project?.id]);

  const runGenerate = useCallback(
    async (preserveEdits: boolean) => {
      if (!project) return;
      const edited = project.outputs?.editedArtifacts ?? [];
      const priorOutputs = project.outputs;
      setGenerating(true);
      setSource(null);
      const startedAt = Date.now();
      const work = (async () => {
        const { artifacts, source } = await fetchGeneration(project);
        let merged: GeneratedArtifacts = {
          ...artifacts,
          generationSource: source as GeneratedArtifacts["generationSource"],
        };
        if (preserveEdits && priorOutputs) {
          const kept: Record<string, string> = {};
          for (const key of edited) {
            const prev = (priorOutputs as Record<string, unknown>)[key];
            if (typeof prev === "string") kept[key] = prev;
          }
          merged = { ...merged, ...kept, editedArtifacts: edited };
        }
        // Park the outgoing blob as a one-step undo before overwriting.
        if (priorOutputs) {
          stashOutputsHistory(project.id, priorOutputs);
          setHistoryAvailable(true);
        }
        updateProject({ outputs: merged });
        setSource(source);
        return { source, ms: Date.now() - startedAt };
      })();
      toast.promise(work, {
        loading: "Generating 15 artifacts…",
        success: ({ source, ms }) => {
          const secs = (ms / 1000).toFixed(1);
          if (source === "ai") return `Generated via OpenAI in ${secs}s`;
          if (source === "template_fallback")
            return `Used template fallback (${secs}s) — AI response was invalid`;
          return `Generated from templates in ${secs}s (no OPENAI_API_KEY)`;
        },
        error: "Generation failed — check the console and try again",
      });
      try {
        await work;
      } catch {
        /* surfaced via toast */
      }
      setGenerating(false);
    },
    [project, updateProject],
  );

  // Step 2 of the generate flow: when hand-edited artifacts exist, the user
  // picks keep/overwrite/cancel in a modal — dismissal is never destructive.
  const startGenerate = useCallback(() => {
    if (!project) return;
    if ((project.outputs?.editedArtifacts?.length ?? 0) > 0) {
      setRegenChoiceOpen(true);
      return;
    }
    void runGenerate(false);
  }, [project, runGenerate]);

  // Pre-flight: if the project is thin in many artifacts, surface a confirm
  // dialog before burning an LLM round-trip.
  const generate = useCallback(() => {
    if (!project) return;
    const readiness = assessGenerationReadiness(project);
    if (!readiness.ok) {
      setPreflightOpen(true);
      return;
    }
    startGenerate();
  }, [project, startGenerate]);

  const generateAnyway = useCallback(() => {
    setPreflightOpen(false);
    startGenerate();
  }, [startGenerate]);

  const regenKeepEdits = useCallback(() => {
    setRegenChoiceOpen(false);
    void runGenerate(true);
  }, [runGenerate]);

  const regenOverwriteAll = useCallback(() => {
    setRegenChoiceOpen(false);
    void runGenerate(false);
  }, [runGenerate]);

  // Swap the stored pack with the parked previous generation. Stashing the
  // current pack first makes restore reversible (a second click swaps back).
  const restorePrevious = useCallback(() => {
    if (!project) return;
    const previous = readOutputsHistory(project.id);
    if (!previous) {
      setHistoryAvailable(false);
      return;
    }
    if (project.outputs) stashOutputsHistory(project.id, project.outputs);
    updateProject({ outputs: previous });
    setSource(null);
    toast.success("Previous generation restored", {
      description: "Restore again to swap back.",
    });
  }, [project, updateProject]);

  // Regenerate a single artifact: full generation under the hood, but only
  // the selected key is merged into the stored pack. Pack-level metadata
  // (hash, timestamp, provenance) stays put so stale detection still
  // reflects the pack as a whole.
  const regenerateArtifact = useCallback(
    async (key: Tab) => {
      if (!project?.outputs || generating || regeneratingArtifact) return;
      const priorOutputs = project.outputs;
      setRegeneratingArtifact(key);
      const label = ALL_TABS.find((t) => t.key === key)?.label ?? "artifact";
      const work = (async () => {
        const { artifacts, source } = await fetchGeneration(project);
        const fresh = artifacts[key];
        if (typeof fresh !== "string" || !fresh) throw new Error("no_artifact");
        stashOutputsHistory(project.id, priorOutputs);
        setHistoryAvailable(true);
        updateProject({
          outputs: {
            ...priorOutputs,
            [key]: fresh,
            editedArtifacts: (priorOutputs.editedArtifacts ?? []).filter(
              (k) => k !== key,
            ),
          },
        });
        return source;
      })();
      toast.promise(work, {
        loading: `Regenerating ${label}…`,
        success: (source) =>
          source === "ai"
            ? `${label} regenerated via OpenAI`
            : `${label} regenerated from templates`,
        error: "Regeneration failed — try again",
      });
      try {
        await work;
      } catch {
        /* surfaced via toast */
      }
      setRegeneratingArtifact(null);
    },
    [project, generating, regeneratingArtifact, updateProject],
  );

  const copyTab = useCallback(async () => {
    const content = project?.outputs?.[activeTab];
    if (!content) return;
    // Copies leave the app, so the in-app sources panel's [n] markers go too.
    await navigator.clipboard.writeText(stripCitationMarkers(content));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [project, activeTab]);

  const downloadTab = useCallback(() => {
    const content = project?.outputs?.[activeTab];
    if (!content || !project) return;
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    const filename = `${slug}-${activeTab.replace(/([A-Z])/g, "-$1").toLowerCase()}.md`;
    downloadMarkdown(stripCitationMarkers(content), filename);
  }, [project, activeTab]);

  const exportMarkdown = useCallback(() => {
    if (!project) return;
    const content = assembleScopedPack(project, exportScope);
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    downloadMarkdown(content, `${slug}-${exportScope}-pack.md`);
    setExportOpen(false);
  }, [project, exportScope]);

  const exportDocx = useCallback(async () => {
    if (!project) return;
    setExportOpen(false);
    setExportingDocx(true);
    try {
      await downloadPackDocx(project, exportScope);
      toast.success("Word document downloaded");
    } catch (err) {
      toast.error("Word export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setExportingDocx(false);
    }
  }, [project, exportScope]);

  const exportPdf = useCallback(() => {
    if (!project) return;
    setExportOpen(false);
    // Open the layout-free print view in a new tab; it auto-opens the
    // browser's print dialog (Save as PDF).
    window.open(`/print/${project.id}?scope=${exportScope}&auto=1`, "_blank");
  }, [project, exportScope]);

  // ── Inline editing ────────────────────────────────────────────────────────
  const startEditing = useCallback(() => {
    // A parked draft for this artifact resumes as-is; otherwise seed from
    // the stored content.
    setDrafts((prev) =>
      prev[activeTab] !== undefined
        ? prev
        : { ...prev, [activeTab]: project?.outputs?.[activeTab] ?? "" },
    );
  }, [project, activeTab]);

  const discardDraft = useCallback(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeTab];
      return next;
    });
  }, [activeTab]);

  // Cancel discards silently only when the draft is untouched; a dirty draft
  // requires explicit confirmation (Escape/Cancel keep the draft).
  const cancelEditing = useCallback(() => {
    if (draftDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    discardDraft();
  }, [draftDirty, discardDraft]);

  const saveEditing = useCallback(() => {
    if (!project?.outputs) return;
    const value = drafts[activeTab];
    if (value === undefined) return;
    const edited = new Set(project.outputs.editedArtifacts ?? []);
    edited.add(activeTab);
    updateProject({
      outputs: {
        ...project.outputs,
        [activeTab]: value,
        editedArtifacts: Array.from(edited),
      },
    });
    discardDraft();
    toast.success("Artifact saved");
  }, [project, activeTab, drafts, discardDraft, updateProject]);

  // Stale detection: project inputs changed since the artifacts were generated.
  const stale = useMemo(() => {
    if (!project?.outputs?.derivedFromHash) return false;
    return project.outputs.derivedFromHash !== hashGenerationInputs(project);
  }, [project]);

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  const hasOutputs = !!project.outputs;
  const activeContent = project.outputs?.[activeTab];
  const activeTabMeta = ALL_TABS.find((t) => t.key === activeTab)!;
  const editedCount = project.outputs?.editedArtifacts?.length ?? 0;
  // Session state wins (freshest), then the provenance persisted on the blob.
  const displaySource = source ?? project.outputs?.generationSource ?? null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 pt-8 pb-4 space-y-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Deployment Pack</h1>
            <p className="text-muted-foreground text-sm mt-1">
              15 artifacts generated from every input you've captured. Ship the
              customer-facing ones to the client; keep the internal ones for
              handoff.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasOutputs && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportOpen((o) => !o)}
                  disabled={exportingDocx}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors inline-flex items-center gap-1.5"
                >
                  {exportingDocx ? "Exporting…" : "Export pack"}
                  <span aria-hidden className="text-[10px]">
                    ▾
                  </span>
                </button>
                {exportOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setExportOpen(false)}
                      aria-hidden
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 z-20 w-56 rounded-md border bg-background shadow-md py-1"
                    >
                      {/* Audience scope — applies to all three formats. */}
                      <div className="px-3 pt-1.5 pb-2 border-b mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Scope
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              "full",
                              "customer",
                              "internal",
                              "technical",
                            ] as const
                          ).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setExportScope(s)}
                              aria-pressed={exportScope === s}
                              className={cn(
                                "text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize",
                                exportScope === s
                                  ? "bg-foreground text-background border-foreground"
                                  : "border-border text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={exportPdf}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/40"
                      >
                        📄 PDF (print)
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={exportDocx}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/40"
                      >
                        📝 Word (.docx)
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={exportMarkdown}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/40"
                      >
                        ⬇ Markdown (.md)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {historyAvailable && !generating && (
              <button
                type="button"
                onClick={restorePrevious}
                title="Swap back to the pack from before the last regeneration"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                ↺ Restore previous
              </button>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className={cn(
                "text-sm px-4 py-1.5 rounded-md font-medium transition-colors",
                generating
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {generating
                ? "Generating…"
                : hasOutputs
                  ? "Regenerate all"
                  : "Generate pack"}
            </button>
          </div>
        </div>

        {displaySource && (
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Generated via{" "}
              <span className="font-medium">
                {displaySource === "ai"
                  ? "OpenAI (gpt-4o-mini)"
                  : "deterministic templates"}
              </span>
              {project.outputs?.generatedAt && (
                <>
                  {" "}
                  at{" "}
                  {new Date(project.outputs.generatedAt).toLocaleString(
                    undefined,
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                </>
              )}
            </span>
            {displaySource === "template_fallback" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-medium">
                ⚠ Fallback content — the AI response was invalid, so this pack
                is template boilerplate
              </span>
            )}
          </p>
        )}

        {hasOutputs && (
          <StaleArtifactsBanner
            stale={stale}
            generating={generating}
            onRegenerate={generate}
            generatedAt={project.outputs?.generatedAt}
          />
        )}

        {!hasOutputs && !generating && (
          <div className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground space-y-1">
            <p>
              Click <strong className="text-foreground">Generate pack</strong>{" "}
              to produce all 15 artifacts.
            </p>
            <p className="text-xs text-muted-foreground/80">
              Works with or without an OpenAI API key — falls back to
              deterministic templates.
            </p>
          </div>
        )}

        <PageNav />
      </div>

      {hasOutputs && (
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Mobile: view-mode strip on top */}
          <div className="md:hidden flex items-center gap-1 px-3 py-2 border-b overflow-x-auto bg-background">
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={cn(
                "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors",
                viewMode === "overview"
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              📦 Overview
            </button>
            <Link
              href={`/workspace/${project.id}/outputs/matrix`}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground"
            >
              📊 Matrix
            </Link>
            {viewMode === "artifact" && (
              <button
                type="button"
                onClick={openSources}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground"
              >
                🔍 Sources
              </button>
            )}
          </div>

          {/* Mobile: horizontal artifact-picker strip — visible whenever there
              are outputs. Tap a pill to switch the active artifact. Replaces
              the bottom-sheet artifact picker (less friction than open → tap → close). */}
          <div
            className="md:hidden flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto bg-background/95 backdrop-blur"
            role="tablist"
            aria-label="Pick an artifact"
          >
            {ALL_TABS.map((tab) => {
              const readiness = getArtifactReadiness(project, tab.key);
              const isActive = viewMode === "artifact" && activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setViewMode("artifact");
                  }}
                  className={cn(
                    "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground bg-background hover:bg-muted/40",
                  )}
                  title={`${tab.label} · ${readinessTooltip(readiness)}`}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      READINESS_DOT[readiness],
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sidebar (desktop only) */}
          <div className="hidden md:flex flex-col w-52 shrink-0 border-r overflow-y-auto py-2">
            {/* Readiness legend */}
            <div
              className="px-3 pb-2 border-b mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground"
              aria-label="Readiness legend"
            >
              {(["rich", "usable", "thin", "empty"] as const).map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1"
                  title={readinessTooltip(r)}
                >
                  <span
                    className={cn("w-1.5 h-1.5 rounded-full", READINESS_DOT[r])}
                    aria-hidden
                  />
                  {READINESS_LABEL[r]}
                </span>
              ))}
            </div>
            {/* View mode at top */}
            <div className="px-2 pb-2 border-b mb-1 space-y-1">
              <button
                type="button"
                onClick={() => setViewMode("overview")}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2",
                  viewMode === "overview"
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <span>📦</span> Pack Overview
              </button>
            </div>

            {GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
                {group.tabs.map((tab) => {
                  const readiness = getArtifactReadiness(project, tab.key);
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.key);
                        setViewMode("artifact");
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm transition-colors leading-snug flex items-center gap-2",
                        viewMode === "artifact" && activeTab === tab.key
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                      title={`${tab.label} · ${readinessTooltip(readiness)}`}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          READINESS_DOT[readiness],
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Content — desktop is now 2-column (sidebar + main). Sources opens
              as a right Sheet on demand for all viewports. */}
          {viewMode === "overview" ? (
            <div className="flex-1 overflow-y-auto bg-muted/20">
              <PackOverview
                project={project}
                onPickArtifact={(key) => {
                  setActiveTab(key);
                  setViewMode("artifact");
                }}
                generatedAt={project.outputs?.generatedAt}
                source={displaySource}
                stale={stale}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-muted/20">
              <div className="px-8 py-6 max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="rounded-md bg-background border px-4 py-2.5 flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 text-sm flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        For
                      </span>
                      <span className="font-medium">
                        {activeTabMeta.audience}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Purpose
                      </span>
                      <span className="text-muted-foreground">
                        {activeTabMeta.purpose}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEditing}
                          className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={openSources}
                          className="hidden md:inline-flex text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background items-center gap-1"
                        >
                          🔍 Sources
                        </button>
                        {activeContent && (
                          <button
                            type="button"
                            onClick={startEditing}
                            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background"
                          >
                            ✎ Edit
                          </button>
                        )}
                        {activeContent && (
                          <button
                            type="button"
                            onClick={() => void regenerateArtifact(activeTab)}
                            disabled={
                              generating || regeneratingArtifact !== null
                            }
                            title="Regenerate only this artifact; everything else is left untouched"
                            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {regeneratingArtifact === activeTab ? (
                              <>
                                <span
                                  className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"
                                  aria-hidden
                                />
                                Regenerating…
                              </>
                            ) : (
                              "↻ Regenerate"
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={copyTab}
                          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background"
                        >
                          {copied ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={downloadTab}
                          className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background"
                        >
                          Download .md
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {project.outputs?.editedArtifacts?.includes(activeTab) &&
                  !editing && (
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-medium">
                        ✎ Edited
                      </span>{" "}
                      You&apos;ve hand-edited this artifact. Regenerating will
                      ask before overwriting it.
                    </p>
                  )}

                {editing ? (
                  <div className="bg-background rounded-lg border shadow-sm p-4 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Editing Markdown — your changes are saved to this project
                      only and survive regeneration unless you choose to
                      overwrite.
                    </p>
                    <textarea
                      value={draft ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [activeTab]: e.target.value,
                        }))
                      }
                      rows={24}
                      className="w-full font-mono text-xs leading-relaxed rounded-md border bg-background px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                      spellCheck={false}
                    />
                  </div>
                ) : activeContent ? (
                  <div className="bg-background rounded-lg border shadow-sm overflow-hidden">
                    {/* Cover header — gives each artifact a document feel. */}
                    <div className="px-8 pt-6 pb-4 border-b bg-muted/20">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {project.customer.companyName || project.name} ·
                        Deployment Pack
                      </p>
                      <h2 className="text-lg font-bold mt-0.5">
                        {activeTabMeta.label}
                      </h2>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        For {activeTabMeta.audience}
                        {project.outputs?.generatedAt && (
                          <>
                            {" · "}
                            {new Date(
                              project.outputs.generatedAt,
                            ).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="px-8 py-8">
                      <ArtifactProse
                        content={activeContent}
                        onChipClick={openSources}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-background rounded-lg border px-8 py-8">
                    <p className="text-sm text-muted-foreground italic">
                      No content generated for this artifact.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources sheet — single sheet for all viewports. Opens via [N] chip,
          mobile-strip "Sources" pill, or the desktop toolbar button. */}
      {project && (
        <Sheet
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
          side="right"
          ariaLabel="Sources used by this artifact"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Sources</p>
            <button
              type="button"
              onClick={() => setSourcesOpen(false)}
              className="text-xs px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Close sources panel"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ArtifactSourcesPanel project={project} artifactKey={activeTab} />
          </div>
        </Sheet>
      )}

      {/* Pre-flight — centered modal. No swipe-away; user picks one of two
          explicit buttons. */}
      {project && (
        <Modal
          open={preflightOpen}
          onOpenChange={setPreflightOpen}
          ariaLabel="Generation pre-flight check"
        >
          <div className="p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold">Inputs are thin</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Some artifacts will be light-weight if you generate now.
              </p>
            </div>
            {(() => {
              const r = assessGenerationReadiness(project);
              return (
                <>
                  <p className="text-xs text-muted-foreground">
                    {r.gaps.length} of {r.totalCount} artifacts have thin or
                    empty inputs. Fill the gaps first for stronger output, or
                    generate anyway.
                  </p>
                  <ul className="space-y-1 max-h-56 overflow-y-auto -mx-1 px-1">
                    {r.gaps.slice(0, 8).map((g) => (
                      <li
                        key={g.key}
                        className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-muted/20"
                      >
                        <span className="truncate">
                          <span
                            className={cn(
                              "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                              g.readiness === "empty"
                                ? "bg-red-500"
                                : "bg-muted-foreground/40",
                            )}
                            aria-hidden
                          />
                          {g.label}
                        </span>
                        {g.hintTab && (
                          <Link
                            href={`/workspace/${project.id}/${g.hintTab}`}
                            onClick={() => setPreflightOpen(false)}
                            className="text-[11px] text-foreground/80 hover:text-foreground underline-offset-2 hover:underline shrink-0"
                          >
                            Fix in {g.hintTab} →
                          </Link>
                        )}
                      </li>
                    ))}
                    {r.gaps.length > 8 && (
                      <li className="text-[10px] text-muted-foreground italic px-2">
                        + {r.gaps.length - 8} more
                      </li>
                    )}
                  </ul>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreflightOpen(false)}
                      className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    >
                      Fill gaps first
                    </button>
                    <button
                      type="button"
                      onClick={generateAnyway}
                      className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
                    >
                      Generate anyway
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Regenerate-all choice — replaces window.confirm. Three explicit
          choices; Escape/backdrop = Cancel, so dismissal is never the
          destructive path. */}
      {project && (
        <Modal
          open={regenChoiceOpen}
          onOpenChange={setRegenChoiceOpen}
          dismissOnBackdrop
          ariaLabel="Choose what happens to your edited artifacts"
        >
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">
                You&apos;ve hand-edited {editedCount} artifact
                {editedCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Regenerating can keep your edited text in place or replace
                everything with fresh output. Either way the current pack is
                kept as a one-step undo (&quot;Restore previous&quot;).
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRegenChoiceOpen(false)}
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={regenOverwriteAll}
                className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
              >
                Overwrite all
              </button>
              <button
                type="button"
                onClick={regenKeepEdits}
                className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
              >
                Keep my edits
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Discard-draft confirm — Cancel on a dirty draft routes here instead
          of silently dropping the text. */}
      <ConfirmActionModal
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        title="Discard unsaved changes?"
        description={`Your edits to "${activeTabMeta.label}" haven't been saved. Discarded text can't be recovered.`}
        confirmLabel="Discard changes"
        onConfirm={discardDraft}
      />
    </div>
  );
}
