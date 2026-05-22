"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  Fragment,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  assembleOnboardingPack,
  downloadMarkdown,
} from "@/lib/markdown-export";
import { PageNav } from "@/components/PageNav";
import { StaleArtifactsBanner } from "@/components/outputs/StaleArtifactsBanner";
import { ArtifactSourcesPanel } from "@/components/outputs/ArtifactSourcesPanel";
import { PackOverview } from "@/components/outputs/PackOverview";
import { SourceChip } from "@/components/outputs/SourceChip";
import { Sheet } from "@/components/ui/sheet";
import { Modal } from "@/components/ui/modal";
import { hashGenerationInputs } from "@/lib/artifact-helpers";
import { getArtifactReadiness, type ArtifactKey } from "@/lib/artifact-sources";
import {
  READINESS_DOT,
  READINESS_LABEL,
  readinessTooltip,
} from "@/lib/readiness";
import { assessGenerationReadiness } from "@/lib/generation-readiness";

// Transform plain text children inside markdown nodes — split any [N] tokens
// out as <SourceChip n={N} /> components, leaving everything else as text.
// Only acts on string children; recursive elements pass through.
function renderChildrenWithChips(
  children: ReactNode,
  onChipClick: () => void,
): ReactNode {
  if (typeof children === "string") {
    const parts: ReactNode[] = [];
    const re = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(children)) !== null) {
      if (match.index > lastIndex)
        parts.push(children.slice(lastIndex, match.index));
      parts.push(
        <SourceChip
          key={`chip-${match.index}`}
          n={parseInt(match[1], 10)}
          onClick={onChipClick}
        />,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < children.length) parts.push(children.slice(lastIndex));
    return parts.length === 1 ? parts[0] : parts;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{renderChildrenWithChips(c, onChipClick)}</Fragment>
    ));
  }
  return children;
}

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

  const runGenerate = useCallback(async () => {
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
  }, [project, updateProject]);

  // Pre-flight: if the project is thin in many artifacts, surface a confirm
  // dialog before burning an LLM round-trip.
  const generate = useCallback(() => {
    if (!project) return;
    const readiness = assessGenerationReadiness(project);
    if (!readiness.ok) {
      setPreflightOpen(true);
      return;
    }
    void runGenerate();
  }, [project, runGenerate]);

  const generateAnyway = useCallback(() => {
    setPreflightOpen(false);
    void runGenerate();
  }, [runGenerate]);

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
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    const filename = `${slug}-${activeTab.replace(/([A-Z])/g, "-$1").toLowerCase()}.md`;
    downloadMarkdown(content, filename);
  }, [project, activeTab]);

  const exportMarkdown = useCallback(() => {
    if (!project) return;
    const content = assembleOnboardingPack(project);
    const slug = project.customer.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    downloadMarkdown(content, `${slug}-onboarding-pack.md`);
  }, [project]);

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

        {source && (
          <p className="text-xs text-muted-foreground">
            Generated via{" "}
            <span className="font-medium">
              {source === "ai"
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
                source={source}
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
                    <button
                      type="button"
                      onClick={openSources}
                      className="hidden md:inline-flex text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background items-center gap-1"
                    >
                      🔍 Sources
                    </button>
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
                          p: ({ children }) => (
                            <p>
                              {renderChildrenWithChips(children, openSources)}
                            </p>
                          ),
                          li: ({ children }) => (
                            <li>
                              {renderChildrenWithChips(children, openSources)}
                            </li>
                          ),
                          td: ({ children }) => (
                            <td>
                              {renderChildrenWithChips(children, openSources)}
                            </td>
                          ),
                        }}
                      >
                        {activeContent}
                      </ReactMarkdown>
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
    </div>
  );
}
