"use client";

import { cn } from "@/lib/utils";

type Props = {
  stale: boolean;
  generating: boolean;
  onSync: () => void;
  variant?: "current" | "future";
};

// Shown above a canvas when the workflow step list has changed since the canvas
// was last generated. Offers a one-click resync.
export function StaleBanner({ stale, generating, onSync, variant = "current" }: Props) {
  if (!stale) return null;

  const label = variant === "future"
    ? "Workflow steps have changed since this future-state map was generated."
    : "Workflow steps have changed since this map was generated.";

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 flex items-center justify-between gap-3">
      <p className="text-xs text-amber-900 leading-snug flex-1">
        <span className="font-semibold">{label}</span>{" "}
        <span className="text-amber-800/80">Keep editing — or pull the latest steps in.</span>
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={generating}
        className={cn(
          "shrink-0 text-xs px-3 py-1 rounded-md font-medium transition-colors",
          generating
            ? "bg-amber-200/60 text-amber-700 cursor-not-allowed"
            : "bg-amber-500 text-white hover:bg-amber-600"
        )}
      >
        {generating ? "Syncing…" : "Sync from steps"}
      </button>
    </div>
  );
}
