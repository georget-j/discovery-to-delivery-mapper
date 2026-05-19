"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { assembleOnboardingPack, downloadMarkdown } from "@/lib/markdown-export";
import { PageNav } from "@/components/PageNav";
import type { GeneratedArtifacts } from "@/lib/types";

type Tab = keyof GeneratedArtifacts;

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

const GROUPS: Group[] = [
  {
    label: "Customer-Facing",
    tabs: [
      { key: "executiveSummary", label: "Executive Summary", audience: "Customer C-suite", purpose: "Executive alignment and buy-in" },
      { key: "futureStateWorkflow", label: "Future State Workflow", audience: "Customer", purpose: "Alignment on AI-enhanced future state" },
      { key: "pilotSuccessPlan", label: "Pilot Success Plan", audience: "Customer", purpose: "Pilot scope and success criteria" },
      { key: "stakeholderCommunicationPlan", label: "Comms Plan", audience: "CSM", purpose: "Stakeholder engagement cadence" },
      { key: "nextActionsChecklist", label: "Next Actions", audience: "CSM + Customer", purpose: "Post-meeting action tracking" },
    ],
  },
  {
    label: "Internal",
    tabs: [
      { key: "customerDiscoverySummary", label: "Discovery Summary", audience: "Internal", purpose: "Sales-to-deployment handoff" },
      { key: "requirementsMatrix", label: "Requirements Matrix", audience: "Engineering", purpose: "Technical requirements sign-off" },
      { key: "missingInformationLog", label: "Missing Info Log", audience: "CSM + Customer", purpose: "Resolving open items before pilot" },
      { key: "riskRegisterSummary", label: "Risk Register Summary", audience: "Customer Exec", purpose: "Risk awareness and mitigation alignment" },
      { key: "implementationPlan", label: "Implementation Plan", audience: "Customer + Internal", purpose: "Project timeline and phase planning" },
    ],
  },
  {
    label: "Technical",
    tabs: [
      { key: "currentStateWorkflow", label: "Current State Workflow", audience: "Eng + Product", purpose: "Baseline understanding of current process" },
      { key: "integrationAndApiPlan", label: "Integration & API Plan", audience: "Engineering", purpose: "Integration design and scope" },
      { key: "dataReadinessAssessment", label: "Data Readiness", audience: "Data + Eng", purpose: "Data quality and access validation" },
      { key: "engineeringHandoff", label: "Engineering Handoff", audience: "Engineering", purpose: "Technical specification and blockers" },
    ],
  },
  {
    label: "Product",
    tabs: [
      { key: "productFeedbackMemo", label: "Product Feedback Memo", audience: "Product", purpose: "Product gaps and feature requests" },
    ],
  },
];

const ALL_TABS: TabMeta[] = GROUPS.flatMap((g) => g.tabs);

export default function OutputsPage() {
  const { project, loading, updateProject } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>("executiveSummary");
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);
    setSource(null);
    try {
      const res = await fetch("/api/generate/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      const data = await res.json();
      if (data.artifacts) {
        updateProject({ outputs: data.artifacts });
        setSource(data.source);
      }
    } catch (err) {
      console.error("Generation failed", err);
    } finally {
      setGenerating(false);
    }
  }, [project, updateProject]);

  const copyTab = useCallback(async () => {
    const content = project?.outputs?.[activeTab];
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [project, activeTab]);

  const downloadTab = useCallback(() => {
    const content = project?.outputs?.[activeTab];
    if (!content || !project) return;
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const tabMeta = ALL_TABS.find((t) => t.key === activeTab);
    const filename = `${slug}-${activeTab.replace(/([A-Z])/g, "-$1").toLowerCase()}.md`;
    downloadMarkdown(content, filename);
  }, [project, activeTab]);

  const exportMarkdown = useCallback(() => {
    if (!project) return;
    const content = assembleOnboardingPack(project);
    const slug = project.customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadMarkdown(content, `${slug}-onboarding-pack.md`);
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
            <h1 className="text-xl font-bold">Generate Outputs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate all 15 onboarding artifacts from your project data. Export as a full Markdown pack.
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
              {generating ? "Generating…" : hasOutputs ? "Regenerate" : "Generate Outputs"}
            </button>
          </div>
        </div>

        {source && (
          <p className="text-xs text-muted-foreground">
            Generated via:{" "}
            <span className="font-medium capitalize">
              {source === "ai" ? "OpenAI (gpt-4o-mini)" : "Deterministic templates (no API key)"}
            </span>
          </p>
        )}

        {!hasOutputs && !generating && (
          <div className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Click &ldquo;Generate Outputs&rdquo; to produce all 15 onboarding artifacts. Works with or without an OpenAI API key.
          </div>
        )}

        <PageNav />
      </div>

      {hasOutputs && (
        <div className="flex flex-1 min-h-0">
          {/* Grouped tab sidebar */}
          <div className="w-52 shrink-0 border-r overflow-y-auto py-2">
            {GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
                {group.tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm transition-colors leading-snug",
                      activeTab === tab.key
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

          {/* Content panel */}
          <div className="flex-1 overflow-y-auto bg-muted/20">
            <div className="px-8 py-6 max-w-3xl mx-auto space-y-4">
              {/* Audience + purpose banner */}
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-md bg-background border px-4 py-2.5 flex-1">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">For:</span>
                    <span className="font-medium">{activeTabMeta.audience}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground">Purpose:</span>
                    <span className="text-muted-foreground">{activeTabMeta.purpose}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyTab}
                    className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors bg-background"
                  >
                    {copied ? "Copied!" : "Copy"}
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

              {/* Document card */}
              {activeContent ? (
                <div className="bg-background rounded-lg border shadow-sm px-8 py-8">
                  <div className="prose prose-sm max-w-none text-foreground [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:leading-relaxed [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_code]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_table]:w-full [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:pb-2 [&_td]:py-1.5 [&_td]:text-sm [&_tr]:border-b [&_tr]:border-border/50 [&_ul]:space-y-1 [&_li]:leading-relaxed [&_input[type=checkbox]]:mr-2">
                    <ReactMarkdown>
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
        </div>
      )}
    </div>
  );
}
