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

export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  if (state === "saved") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-emerald-700 text-xs", className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Saved
      </span>
    );
  }
  if (state === "saving") {
    return <span className={cn("text-xs text-muted-foreground", className)}>Saving…</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground text-xs", className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      Ready
    </span>
  );
}
