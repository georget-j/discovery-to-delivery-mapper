"use client";

import { useState, useCallback, useMemo, Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { assembleOnboardingPack, downloadMarkdown } from "@/lib/markdown-export";
import { PageNav } from "@/components/PageNav";
import { StaleArtifactsBanner } from "@/components/outputs/StaleArtifactsBanner";
import { ArtifactSourcesPanel } from "@/components/outputs/ArtifactSourcesPanel";
import { CoverageMatrix } from "@/components/outputs/CoverageMatrix";
import { SourceChip } from "@/components/outputs/SourceChip";
import { hashGenerationInputs } from "@/lib/artifact-helpers";
import type { ArtifactKey } from "@/lib/artifact-sources";

// Transform plain text children inside markdown nodes — split any [N] tokens
// out as <SourceChip n={N} /> components, leaving everything else as text.
// Only acts on string children; recursive elements pass through.
function renderChildrenWithChips(children: ReactNode, onChipClick: () => void): ReactNode {
  if (typeof children === "string") {
    const parts: ReactNode[] = [];
    const re = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(children)) !== null) {
      if (match.index > lastIndex) parts.push(children.slice(lastIndex, match.index));
      parts.push(<SourceChip key={`chip-${match.index}`} n={parseInt(match[1], 10)} onClick={onChipClick} />);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < children.length) parts.push(children.slice(lastIndex));
    return parts.length === 1 ? parts[0] : parts;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => <Fragment key={i}>{renderChildrenWithChips(c, onChipClick)}</Fragment>);
  }
  return children;
}

type Tab = ArtifactKey;
type ViewMode = "artifact" | "matrix";

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
      { key: "executiveSummary",            label: "Executive Summary",       audience: "Customer C-suite",    purpose: "Get sign-off on the deployment in one page" },
      { key: "futureStateWorkflow",         label: "Future State Workflow",   audience: "Customer + AI Lead",  purpose: "Show exactly how AI fits into their workflow" },
      { key: "pilotSuccessPlan",            label: "Pilot Success Plan",      audience: "Customer + Sponsor",  purpose: "Lock down what 'pilot success' means before kick-off" },
      { key: "stakeholderCommunicationPlan", label: "Comms Plan",             audience: "CSM",                 purpose: "Decide who hears what, and how often" },
      { key: "nextActionsChecklist",        label: "Next Actions",            audience: "CSM + Customer",      purpose: "End every meeting with named owners and dates" },
    ],
  },
  {
    label: "Internal",
    tabs: [
      { key: "customerDiscoverySummary",    label: "Discovery Summary",       audience: "Internal handoff",    purpose: "Brief the deployment team in 5 minutes" },
      { key: "requirementsMatrix",          label: "Requirements Matrix",     audience: "Engineering",         purpose: "Sign-off list before integration sprint" },
      { key: "missingInformationLog",       label: "Missing Info Log",        audience: "CSM + Customer",      purpose: "Track every unresolved question with an owner" },
      { key: "riskRegisterSummary",         label: "Risk Register Summary",   audience: "Customer Exec",       purpose: "Surface what could derail the pilot, with mitigation" },
      { key: "implementationPlan",          label: "Implementation Plan",     audience: "Customer + Internal", purpose: "Phase the work from kick-off to rollout" },
    ],
  },
  {
    label: "Technical",
    tabs: [
      { key: "currentStateWorkflow",        label: "Current State Workflow",  audience: "Eng + Product",       purpose: "Baseline the process as it actually works today" },
      { key: "integrationAndApiPlan",       label: "Integration & API Plan",  audience: "Engineering",         purpose: "Scope every integration, including the ones without APIs" },
      { key: "dataReadinessAssessment",     label: "Data Readiness",          audience: "Data + Eng",          purpose: "Decide whether the data can carry the AI" },
      { key: "engineeringHandoff",          label: "Engineering Handoff",     audience: "Engineering",         purpose: "Everything engineering needs on day one" },
    ],
  },
  {
    label: "Product",
    tabs: [
      { key: "productFeedbackMemo",         label: "Product Feedback Memo",   audience: "Product",             purpose: "Capture what this engagement revealed about the product" },
    ],
  },
];

const ALL_TABS: TabMeta[] = GROUPS.flatMap((g) => g.tabs);

export default function OutputsPage() {
  const { project, loading, updateProject } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>("executiveSummary");
  const [viewMode, setViewMode] = useState<ViewMode>("artifact");
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [panelFlash, setPanelFlash] = useState(0);

  const flashSourcesPanel = useCallback(() => setPanelFlash((n) => n + 1), []);

  const generate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);
    setSource(null);
    const startedAt = Date.now();
    const work = (async () => {
      const res = await fetch("/api/generate/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      const data = await res.json();
      if (!data.artifacts) throw new Error(data.error ?? "no_artifacts");
      updateProject({ outputs: data.artifacts });
      setSource(data.source);
      return { source: data.source as string, ms: Date.now() - startedAt };
    })();
    toast.promise(work, {
      loading: "Generating 15 artifacts…",
      success: ({ source, ms }) => {
        const secs = (ms / 1000).toFixed(1);
        if (source === "ai") return `Generated via OpenAI in ${secs}s`;
        if (source === "template_fallback") return `Used template fallback (${secs}s) — AI response was invalid`;
        return `Generated from templates in ${secs}s (no OPENAI_API_KEY)`;
      },
      error: "Generation failed — check the console and try again",
    });
    try { await work; } catch { /* surfaced via toast */ }
    setGenerating(false);
  }, [project, updateProject]);

  const copyTab = useCallback(async () => {
    const content = project?.outputs?.[activeTab];
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [project, activeTab]);

  const downloadTab = useCallback(() => {
    const content = project?.outputs?.[activeTab];
    if (!content || !project) return;
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `${slug}-${activeTab.replace(/([A-Z])/g, "-$1").toLowerCase()}.md`;
    downloadMarkdown(content, filename);
  }, [project, activeTab]);

  const exportMarkdown = useCallback(() => {
    if (!project) return;
    const content = assembleOnboardingPack(project);
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadMarkdown(content, `${slug}-onboarding-pack.md`);
  }, [project]);

  // Stale detection: project inputs changed since the artifacts were generated.
  const stale = useMemo(() => {
    if (!project?.outputs?.derivedFromHash) return false;
    return project.outputs.derivedFromHash !== hashGenerationInputs(project);
  }, [project]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8 text-sm text-muted-foreground">Project not found.</div>;

  const hasOutputs = !!project.outputs;
  const activeContent = project.outputs?.[activeTab];
  const activeTabMeta = ALL_TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 space-y-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Deployment Pack</h1>
            <p className="text-muted-foreground text-sm mt-1">
              15 artifacts generated from every input you've captured. Ship the customer-facing ones to the client; keep the internal ones for handoff.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasOutputs && (
              <button
                type="button"
                onClick={exportMarkdown}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                Export full pack
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
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {generating ? "Generating…" : hasOutputs ? "Regenerate all" : "Generate pack"}
            </button>
          </div>
        </div>

        {source && (
          <p className="text-xs text-muted-foreground">
            Generated via{" "}
            <span className="font-medium">
              {source === "ai" ? "OpenAI (gpt-4o-mini)" : "deterministic templates"}
            </span>
            {project.outputs?.generatedAt && (
              <> at {new Date(project.outputs.generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</>
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
            <p>Click <strong className="text-foreground">Generate pack</strong> to produce all 15 artifacts.</p>
            <p className="text-xs text-muted-foreground/80">Works with or without an OpenAI API key — falls back to deterministic templates.</p>
          </div>
        )}

        <PageNav />
      </div>

      {hasOutputs && (
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-52 shrink-0 border-r overflow-y-auto py-2">
            {/* View mode at top */}
            <div className="px-2 pb-2 border-b mb-1">
              <button
                type="button"
                onClick={() => setViewMode("matrix")}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2",
                  viewMode === "matrix"
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span>📊</span> Coverage Matrix
              </button>
            </div>

            {GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
                {group.tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => { setActiveTab(tab.key); setViewMode("artifact"); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm transition-colors leading-snug",
                      viewMode === "artifact" && activeTab === tab.key
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Content */}
          {viewMode === "matrix" ? (
            <div className="flex-1 overflow-y-auto bg-muted/20">
              <div className="px-8 py-6 max-w-6xl mx-auto">
                <CoverageMatrix
                  project={project}
                  onPickArtifact={(key) => { setActiveTab(key); setViewMode("artifact"); }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Artifact content panel */}
              <div className="flex-1 overflow-y-auto bg-muted/20">
                <div className="px-8 py-6 max-w-3xl mx-auto space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="rounded-md bg-background border px-4 py-2.5 flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 text-sm flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">For</span>
                        <span className="font-medium">{activeTabMeta.audience}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Purpose</span>
                        <span className="text-muted-foreground">{activeTabMeta.purpose}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                    </div>
                  </div>

                  {activeContent ? (
                    <div className="bg-background rounded-lg border shadow-sm px-8 py-8">
                      <div className="prose prose-sm max-w-none text-foreground [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:leading-relaxed [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_code]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_table]:w-full [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:pb-2 [&_td]:py-1.5 [&_td]:text-sm [&_tr]:border-b [&_tr]:border-border/50 [&_ul]:space-y-1 [&_li]:leading-relaxed [&_input[type=checkbox]]:mr-2">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p>{renderChildrenWithChips(children, flashSourcesPanel)}</p>,
                            li: ({ children }) => <li>{renderChildrenWithChips(children, flashSourcesPanel)}</li>,
                            td: ({ children }) => <td>{renderChildrenWithChips(children, flashSourcesPanel)}</td>,
                          }}
                        >
                          {activeContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-background rounded-lg border px-8 py-8">
                      <p className="text-sm text-muted-foreground italic">No content generated for this artifact.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sources panel (right) — flashes when a SourceChip is clicked */}
              <div
                key={panelFlash /* re-key on flash to re-trigger CSS animation */}
                className="w-72 shrink-0 border-l bg-background overflow-y-auto animate-in fade-in slide-in-from-right-2 duration-200"
              >
                <ArtifactSourcesPanel project={project} artifactKey={activeTab} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
