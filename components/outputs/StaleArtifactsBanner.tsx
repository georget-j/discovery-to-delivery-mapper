"use client";

import { cn } from "@/lib/utils";

type Props = {
  stale: boolean;
  generating: boolean;
  onRegenerate: () => void;
  generatedAt?: string;
};

// Shown at the top of the Outputs page when project inputs have drifted since
// the last artifact generation. Mirrors the workflow-canvas StaleBanner pattern.
export function StaleArtifactsBanner({ stale, generating, onRegenerate, generatedAt }: Props) {
  if (!stale) return null;

  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
      <div className="text-xs text-amber-900 leading-snug flex-1 min-w-0">
        <span className="font-semibold">Project inputs have changed since these artifacts were generated.</span>{" "}
        <span className="text-amber-800/80">
          Regenerate to pick up the latest workflows, systems, risks, and stakeholders.
          {generatedLabel && <> Last generated {generatedLabel}.</>}
        </span>
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={generating}
        className={cn(
          "shrink-0 text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
          generating
            ? "bg-amber-200/60 text-amber-700 cursor-not-allowed"
            : "bg-amber-500 text-white hover:bg-amber-600"
        )}
      >
        {generating ? "Regenerating…" : "Regenerate all"}
      </button>
    </div>
  );
}
