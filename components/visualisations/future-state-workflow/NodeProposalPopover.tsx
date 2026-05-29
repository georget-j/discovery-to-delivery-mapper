"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PATTERN_FAMILY_COLOR } from "@/lib/patterns/future-state-patterns";
import type { NodeProposal } from "@/lib/visualisations/node-proposals";

type Props = {
  proposals: NodeProposal[];
  onApply: (p: NodeProposal) => void;
  onPreview: (p: NodeProposal | null) => void;
  onAskAi?: () => Promise<NodeProposal[]>;
  onClose: () => void;
};

// Contextual "you could…" proposal list, rendered inside a node's bottom
// NodeToolbar. Deterministic proposals show instantly; "Ask AI for ideas"
// appends richer, project-specific ones. Hovering a card previews the
// would-be nodes as a translucent ghost on the canvas.
export function NodeProposalPopover({
  proposals,
  onApply,
  onPreview,
  onAskAi,
  onClose,
}: Props) {
  const [aiProposals, setAiProposals] = useState<NodeProposal[]>([]);
  const [askingAi, setAskingAi] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const all = [...proposals, ...aiProposals].filter(
    (p) => !dismissed.has(p.id),
  );

  const askAi = async () => {
    if (!onAskAi || askingAi) return;
    setAskingAi(true);
    try {
      const extra = await onAskAi();
      // De-dup against ids already shown.
      const known = new Set(all.map((p) => p.id));
      setAiProposals((prev) => [
        ...prev,
        ...extra.filter((p) => !known.has(p.id)),
      ]);
    } finally {
      setAskingAi(false);
    }
  };

  return (
    <div
      className="w-[min(22rem,80vw)] rounded-lg border bg-background shadow-xl"
      onMouseLeave={() => onPreview(null)}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <p className="text-xs font-semibold inline-flex items-center gap-1.5">
          <span aria-hidden>✨</span> Proposals
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-muted/50 text-muted-foreground"
          aria-label="Close proposals"
        >
          ✕
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto p-2 space-y-2">
        {all.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-3 text-center">
            This step already has the usual AI safeguards. Try “Ask AI for
            ideas”.
          </p>
        ) : (
          all.map((p) => (
            <div
              key={p.id}
              onMouseEnter={() => onPreview(p)}
              className="rounded-md border bg-muted/10 p-2 space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0",
                    PATTERN_FAMILY_COLOR[p.patternFamily],
                  )}
                >
                  {p.patternFamily.replace(/_/g, " ")}
                </span>
                <p className="text-xs font-medium leading-snug">{p.title}</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {p.rationale}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => onApply(p)}
                  className="text-[11px] px-2 py-0.5 rounded bg-foreground text-background hover:bg-foreground/90 font-medium"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(p.id))
                  }
                  className="text-[11px] px-2 py-0.5 rounded border hover:bg-muted/40 text-muted-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {onAskAi && (
        <div className="border-t px-2 py-2">
          <button
            type="button"
            onClick={askAi}
            disabled={askingAi}
            className="w-full text-[11px] px-2 py-1.5 rounded border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {askingAi ? "Asking AI…" : "✨ Ask AI for ideas"}
          </button>
        </div>
      )}
    </div>
  );
}
