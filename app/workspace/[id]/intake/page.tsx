"use client";

import { useCallback } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { FileDropzone } from "@/components/intake/FileDropzone";
import { IntakeQueue } from "@/components/intake/IntakeQueue";
import { PasteNoteInput } from "@/components/intake/PasteNoteInput";
import { KbSummary } from "@/components/intake/KbSummary";
import { useIntakeQueue } from "@/components/intake/useIntakeQueue";
import { retrieveForTarget } from "@/lib/kb/retrieve";
import { applySuggestionsToProject } from "@/lib/apply-suggestions";
import { toast } from "@/lib/toast";
import { PageNav } from "@/components/PageNav";
import type { NotesExtractionResult } from "@/lib/types";

export default function IntakePage() {
  const { project, loading, updateProject } = useWorkspace();
  const queue = useIntakeQueue();

  const generateFromKb = useCallback(
    async (
      target:
        | "discovery"
        | "workflows"
        | "systems"
        | "stakeholders"
        | "risks"
        | "all",
    ) => {
      if (!project) return;
      try {
        const retrieved = await retrieveForTarget(project.id, target, 10);
        if (retrieved.length === 0) {
          toast.error("No relevant chunks found", {
            description: "Try uploading more docs or paste richer notes.",
          });
          return;
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
          toast.error("OPENAI_API_KEY missing", {
            description: "Generation needs an API key on the server.",
          });
          return;
        }
        if (data.error || !data.suggestions) {
          toast.error("Generation failed", {
            description: data.message ?? data.error ?? "Unknown error",
          });
          return;
        }
        const suggestions = data.suggestions as NotesExtractionResult;
        const citations = Object.fromEntries(
          retrieved.map((r) => [r.chunk.id, r.label]),
        );

        if (target === "discovery") {
          // Discovery is direct-apply: structured fields, low ambiguity.
          const picks = new Set<string>();
          if (suggestions.discovery)
            Object.keys(suggestions.discovery).forEach((k) =>
              picks.add(`discovery:${k}`),
            );
          const { patch, appliedLabels } = applySuggestionsToProject(
            project,
            suggestions,
            picks as Set<never>,
            citations,
          );
          if (Object.keys(patch).length > 0) {
            updateProject(patch);
            toast.success("Discovery populated", {
              description: appliedLabels.slice(0, 4).join(" · "),
            });
          } else {
            toast.info("Nothing to populate", {
              description: "The KB didn't yield any Discovery fields.",
            });
          }
          return;
        }

        // All other targets stash in pendingSuggestions → SuggestionsBanner
        // picks it up on the relevant tabs.
        updateProject({
          pendingSuggestions: suggestions,
          suggestionsOfferedAt: new Date().toISOString(),
        });
        const counts = countByCategory(suggestions);
        toast.success("Suggestions ready", {
          description: `Drafted ${counts}. Open each tab and click the amber banner to review.`,
        });
      } catch (err) {
        toast.error("Generation failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [project, updateProject],
  );

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );

  const busy = queue.parsingCount + queue.embeddingCount > 0;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Customer Intake</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drop everything you have — call notes, scoping docs, integration
          diagrams, vendor lists. We&apos;ll build a searchable knowledge base
          and use it to pre-populate Discovery, Workflows, Systems,
          Stakeholders, and Risks.
        </p>
      </div>

      <FileDropzone
        disabled={!project}
        onFiles={(files) => queue.enqueue({ files })}
      />

      <PasteNoteInput
        onSubmit={(rawText, name) => queue.enqueue({ rawText, name })}
      />

      <IntakeQueue
        jobs={queue.jobs}
        onCancel={queue.cancel}
        onRetry={queue.retry}
        onRemove={queue.remove}
      />

      <KbSummary
        docs={queue.totals.docs}
        chunks={queue.totals.chunks}
        tokens={queue.totals.tokens}
        busy={busy}
        hasReadyDocs={queue.hasReadyDocs}
        onGenerateDiscovery={() => generateFromKb("discovery")}
        onGenerateAll={() => generateFromKb("all")}
      />

      <PageNav />
    </div>
  );
}

function countByCategory(s: NotesExtractionResult): string {
  const parts: string[] = [];
  if (s.suggestedStakeholders?.length)
    parts.push(`${s.suggestedStakeholders.length} stakeholders`);
  if (s.suggestedWorkflows?.length)
    parts.push(`${s.suggestedWorkflows.length} workflows`);
  if (s.suggestedSystems?.length)
    parts.push(`${s.suggestedSystems.length} systems`);
  if (s.suggestedDataSources?.length)
    parts.push(`${s.suggestedDataSources.length} data sources`);
  if (s.suggestedRisks?.length) parts.push(`${s.suggestedRisks.length} risks`);
  return parts.join(" · ") || "suggestions";
}
