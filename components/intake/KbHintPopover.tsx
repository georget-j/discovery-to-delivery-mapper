"use client";

import { useState } from "react";
import { useKbHints } from "@/components/intake/useKbHints";
import { cn } from "@/lib/utils";

type Props = {
  // The retrieval query — usually a field-purpose phrase plus current value.
  query: string;
  // Insert replaces the field; Append adds to the end. The consumer decides
  // how to apply (it owns the field value).
  onInsert: (text: string, mode: "replace" | "append") => void;
  className?: string;
  enabled?: boolean;
};

// "💡 hints from your docs" affordance shown under a field. Expands to a small
// list of matching KB chunks with Insert / Append actions. Renders nothing
// when the project has no KB or the global toggle is off (the hook handles
// that), so it's safe to drop under any field.
export function KbHintPopover({ query, onInsert, className, enabled }: Props) {
  const { hints, loading } = useKbHints(query, { enabled });
  const [open, setOpen] = useState(false);

  if (hints.length === 0 && !loading) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 transition-colors"
        aria-expanded={open}
      >
        <span aria-hidden>💡</span>
        {loading && hints.length === 0
          ? "Checking your docs…"
          : `${hints.length} hint${hints.length !== 1 ? "s" : ""} from your docs`}
        {hints.length > 0 && <span aria-hidden>{open ? "▲" : "▼"}</span>}
      </button>

      {open && hints.length > 0 && (
        <div className="absolute z-30 mt-1 w-[min(28rem,90vw)] rounded-md border bg-popover shadow-lg p-2 space-y-2">
          {hints.map((h) => (
            <div
              key={h.id}
              className="rounded border bg-muted/20 p-2 text-xs space-y-1.5"
            >
              <p className="text-[10px] font-mono text-muted-foreground">
                {h.label}
              </p>
              <p className="leading-relaxed line-clamp-4">
                {h.text.slice(0, 360)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onInsert(h.text.trim(), "append");
                  }}
                  className="text-[11px] px-2 py-0.5 rounded border hover:bg-muted/40"
                >
                  Append
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInsert(h.text.trim(), "replace");
                  }}
                  className="text-[11px] px-2 py-0.5 rounded border hover:bg-muted/40"
                >
                  Replace
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
