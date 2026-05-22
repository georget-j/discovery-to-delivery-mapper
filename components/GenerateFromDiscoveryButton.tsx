"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Sheet } from "@/components/ui/sheet";
import { NotesDiffPanel } from "@/components/NotesDiffPanel";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  applySuggestionsToProject,
  type KbCitationMap,
  type SuggestionRowId,
} from "@/lib/apply-suggestions";
import { hasReadyKnowledgeBase } from "@/components/intake/useIntakeQueue";
import { retrieveForTarget } from "@/lib/kb/retrieve";
import type { NotesExtractionResult } from "@/lib/types";

type Target = "workflows" | "systems" | "stakeholders" | "risks" | "all";
type Source = "discovery" | "kb" | "both";

type Props = {
  target: Target;
  label?: string;
  className?: string;
};

// Multi-source "✨ Generate" CTA. Default mode = Discovery only (Pass 3
// behavior). When the project has KB chunks, the button becomes a split
// with a menu offering: From Discovery / From Knowledge Base / From Both.
// All three paths return a NotesExtractionResult and feed into the same
// NotesDiffPanel + applySuggestionsToProject pipeline.
export function GenerateFromDiscoveryButton({
  target,
  label,
  className,
}: Props) {
  const { project, updateProject } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<NotesExtractionResult | null>(
    null,
  );
  const [citations, setCitations] = useState<KbCitationMap | undefined>();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  if (!project) return null;

  const ready = !!(
    project.customer.companyName &&
    project.customer.businessProblem &&
    project.discovery.currentProcess
  );
  const kbAvailable = hasReadyKnowledgeBase(project);

  const runDiscovery = async (): Promise<{
    suggestions: NotesExtractionResult;
  } | null> => {
    const res = await fetch("/api/generate/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, target }),
    });
    const data = await res.json();
    if (data.error === "no_api_key") {
      toast.error("AI suggestions need an OPENAI_API_KEY");
      return null;
    }
    if (data.error) {
      toast.error("Generation failed", {
        description:
          typeof data.message === "string" ? data.message : data.error,
      });
      return null;
    }
    return { suggestions: data.suggestions as NotesExtractionResult };
  };

  const runFromKb = async (): Promise<{
    suggestions: NotesExtractionResult;
    citations: KbCitationMap;
  } | null> => {
    const retrieved = await retrieveForTarget(project.id, target, 10);
    if (retrieved.length === 0) {
      toast.error("No KB chunks matched", {
        description: "Upload richer docs on the Intake tab.",
      });
      return null;
    }
    const res = await fetch("/api/generate/from-kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        target,
        contextChunks: retrieved.map((r) => ({
          id: r.chunk.id,
          text: r.chunk.text,
          label: r.label,
        })),
      }),
    });
    const data = await res.json();
    if (data.error === "no_api_key") {
      toast.error("AI suggestions need an OPENAI_API_KEY");
      return null;
    }
    if (data.error) {
      toast.error("Generation failed", {
        description:
          typeof data.message === "string" ? data.message : data.error,
      });
      return null;
    }
    return {
      suggestions: data.suggestions as NotesExtractionResult,
      citations: Object.fromEntries(
        retrieved.map((r) => [r.chunk.id, r.label]),
      ),
    };
  };

  const mergeResults = (
    a: NotesExtractionResult,
    b: NotesExtractionResult,
  ): NotesExtractionResult => ({
    discovery: { ...(a.discovery ?? {}), ...(b.discovery ?? {}) },
    suggestedStakeholders: [
      ...(a.suggestedStakeholders ?? []),
      ...(b.suggestedStakeholders ?? []),
    ],
    suggestedSystems: [
      ...(a.suggestedSystems ?? []),
      ...(b.suggestedSystems ?? []),
    ],
    suggestedDataSources: [
      ...(a.suggestedDataSources ?? []),
      ...(b.suggestedDataSources ?? []),
    ],
    suggestedWorkflows: [
      ...(a.suggestedWorkflows ?? []),
      ...(b.suggestedWorkflows ?? []),
    ],
    suggestedRisks: [...(a.suggestedRisks ?? []), ...(b.suggestedRisks ?? [])],
    summary: [a.summary, b.summary].filter(Boolean).join(" · ") || a.summary,
  });

  const runSource = async (source: Source) => {
    if (!ready && source !== "kb") {
      toast.info("Fill the basics in Discovery first", {
        description:
          "Need company name, business problem, and current process.",
      });
      return;
    }
    setLoading(true);
    try {
      let result: NotesExtractionResult | null = null;
      let cits: KbCitationMap | undefined = undefined;
      if (source === "discovery") {
        const r = await runDiscovery();
        if (!r) return;
        result = r.suggestions;
      } else if (source === "kb") {
        const r = await runFromKb();
        if (!r) return;
        result = r.suggestions;
        cits = r.citations;
      } else {
        const [d, k] = await Promise.all([runDiscovery(), runFromKb()]);
        if (!d && !k) return;
        result =
          d && k
            ? mergeResults(d.suggestions, k.suggestions)
            : (d?.suggestions ?? k?.suggestions ?? null);
        cits = k?.citations;
      }
      if (!result) return;
      const hits =
        (result.suggestedWorkflows?.length ?? 0) +
        (result.suggestedSystems?.length ?? 0) +
        (result.suggestedDataSources?.length ?? 0) +
        (result.suggestedRisks?.length ?? 0) +
        (result.suggestedStakeholders?.length ?? 0);
      if (hits === 0) {
        toast.info("No new suggestions", {
          description: "AI didn't infer anything new from this source.",
        });
        return;
      }
      setSuggestions(result);
      setCitations(cits);
      setOpen(true);
      toast.success(`Drafted ${hits} suggestion${hits !== 1 ? "s" : ""}`, {
        description: "Review and cherry-pick which to add.",
      });
    } catch (err) {
      toast.error("Generation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const handleApply = (selected: Set<SuggestionRowId>) => {
    if (!suggestions) return;
    const { patch, appliedLabels } = applySuggestionsToProject(
      project,
      suggestions,
      selected,
      citations,
    );
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing selected");
      return;
    }
    updateProject(patch);
    setOpen(false);
    setSuggestions(null);
    setCitations(undefined);
    toast.success(
      `Added ${appliedLabels.length} suggestion${appliedLabels.length !== 1 ? "s" : ""}`,
      { description: appliedLabels.slice(0, 3).join(" · ") },
    );
  };

  const buttonLabel = label ?? "✨ Generate";

  return (
    <>
      {kbAvailable ? (
        <div className="relative inline-flex" ref={menuRef}>
          <button
            type="button"
            onClick={() => runSource("both")}
            disabled={loading}
            className={cn(
              "text-xs px-3 py-1.5 rounded-l-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium",
              loading && "opacity-60 cursor-wait",
              className,
            )}
          >
            {loading ? "Drafting…" : `${buttonLabel} (Discovery + KB)`}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((m) => !m)}
            disabled={loading}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Generate options"
            className="text-xs px-2 py-1.5 rounded-r-md border border-l-0 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
          >
            ▼
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-20 w-56 rounded-md border bg-background shadow-md py-1"
            >
              <MenuItem
                onClick={() => runSource("discovery")}
                title="From Discovery only"
                subtitle="Industry-typical inference"
              />
              <MenuItem
                onClick={() => runSource("kb")}
                title="From Knowledge Base only"
                subtitle="Grounded in uploaded docs"
              />
              <MenuItem
                onClick={() => runSource("both")}
                title="From Discovery + KB"
                subtitle="Combines both sources"
                emphasis
              />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => runSource("discovery")}
          disabled={loading || !ready}
          title={
            ready
              ? undefined
              : "Fill company name, business problem, and current process in Discovery first"
          }
          className={cn(
            "text-xs px-3 py-1.5 rounded-md border transition-colors font-medium",
            ready
              ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-border text-muted-foreground/60 cursor-not-allowed",
            loading && "opacity-60 cursor-wait",
            className,
          )}
        >
          {loading ? "Drafting…" : `${buttonLabel} from Discovery`}
        </button>
      )}
      {suggestions && (
        <Sheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setSuggestions(null);
              setCitations(undefined);
            }
          }}
          side="right"
          ariaLabel="Review AI suggestions"
          className="!w-[min(32rem,90vw)] !max-w-[90vw]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="text-sm font-semibold">AI Suggestions</p>
              <p className="text-[11px] text-muted-foreground">
                {citations
                  ? `Grounded in ${Object.keys(citations).length} KB chunk${
                      Object.keys(citations).length !== 1 ? "s" : ""
                    }`
                  : "Inferred from your Discovery — pick what to apply."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSuggestions(null);
                setCitations(undefined);
              }}
              className="text-xs px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Close suggestions"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NotesDiffPanel
              suggestions={suggestions}
              project={project}
              onApply={(picked) => handleApply(picked as Set<SuggestionRowId>)}
              onCancel={() => {
                setOpen(false);
                setSuggestions(null);
                setCitations(undefined);
              }}
            />
          </div>
        </Sheet>
      )}
    </>
  );
}

function MenuItem({
  onClick,
  title,
  subtitle,
  emphasis,
}: {
  onClick: () => void;
  title: string;
  subtitle: string;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
    >
      <p
        className={cn(
          "text-xs",
          emphasis ? "font-semibold text-foreground" : "font-medium",
        )}
      >
        {title}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
    </button>
  );
}
