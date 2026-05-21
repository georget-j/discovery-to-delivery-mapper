"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved";

// Watches an updatedAt timestamp and flashes "Saved" for ~1.5s whenever it
// changes from its mount value. Idle state shows a faint dot so the user
// knows the indicator exists. Used inline next to form headers — for
// cross-component / async actions (generate, extract) use toast.success.
export function useSaveIndicator(updatedAt: string | undefined): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const initial = useRef(updatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (updatedAt === initial.current) return; // skip mount
    setState("saved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1500);
  }, [updatedAt]);

  return state;
}

export function SaveIndicator({
  state,
  className,
}: {
  state: SaveState;
  className?: string;
}) {
  if (state === "saved") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-emerald-700 text-xs",
          className,
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Saved
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Saving…
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground text-xs",
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      Ready
    </span>
  );
}

// Watches a single field value and flashes `true` for ~1.2s after the value
// settles (debounced). Skips the initial render so we don't flash on mount.
// Used by FieldSavedFlash to render a small "Saved" caption per field.
export function useFieldFlash(value: unknown, debounceMs = 400): boolean {
  const [flashing, setFlashing] = useState(false);
  const mounted = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setFlashing(true);
      if (visibleTimer.current) clearTimeout(visibleTimer.current);
      visibleTimer.current = setTimeout(() => setFlashing(false), 1200);
    }, debounceMs);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, debounceMs]);

  return flashing;
}

// Tiny "✓ Saved" caption that flashes briefly after a field value commits.
// Drop next to any input where the user benefits from confirmation that
// their change persisted. Page-level SaveIndicator stays for global signal.
export function FieldSavedFlash({
  watch,
  className,
}: {
  watch: unknown;
  className?: string;
}) {
  const flashing = useFieldFlash(watch);
  return (
    <span
      aria-hidden={!flashing}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] text-emerald-700 transition-opacity",
        flashing ? "opacity-100" : "opacity-0 pointer-events-none",
        className,
      )}
    >
      <span aria-hidden>✓</span>
      Saved
    </span>
  );
}
