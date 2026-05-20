"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ux:firstRunSeen";

// One-time orientation banner shown on the workspace Overview until the user
// dismisses it. Persists across all projects via localStorage, so a returning
// user never sees it again. SSR-safe: only reads localStorage in useEffect.
export function FirstRunHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* ignore quota errors */ }
    setShow(false);
  };

  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 px-5 py-4 flex items-start gap-3 mb-6">
      <span className="text-2xl shrink-0" aria-hidden>👋</span>
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-semibold">First time here?</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Walk through the 4 phases — <strong>Discover</strong>, <strong>Design</strong>, <strong>Plan</strong>,{" "}
          <strong>Deliver</strong> — using the cards below. Each phase unlocks the next. Hit{" "}
          <em>Outputs</em> at the end to generate the 15-artifact deployment pack.
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          Everything auto-saves to your browser. No account, no backend.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-background transition-colors shrink-0"
        aria-label="Dismiss first-run hint"
      >
        Got it ✕
      </button>
    </div>
  );
}
