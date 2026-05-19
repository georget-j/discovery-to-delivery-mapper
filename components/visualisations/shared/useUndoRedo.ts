"use client";

import { useRef, useCallback, useEffect } from "react";

// In-memory undo/redo history for a visualisation map. Keeps a stack of snapshots
// of the parent's `current` state; on push, captures a new snapshot.
// Does not persist across page reloads — that's intentional, undo is a session tool.

export function useUndoRedo<T>(current: T | null, persist: (next: T) => void, maxEntries = 50) {
  const stack = useRef<T[]>([]);
  const pointer = useRef<number>(-1);
  const suppressNextSync = useRef(false);

  // Sync external changes into history (skip when the change came from us via undo/redo).
  useEffect(() => {
    if (current == null) return;
    if (suppressNextSync.current) {
      suppressNextSync.current = false;
      return;
    }
    // Truncate any redo branch
    stack.current = stack.current.slice(0, pointer.current + 1);
    stack.current.push(structuredClone(current));
    if (stack.current.length > maxEntries) {
      stack.current.shift();
    } else {
      pointer.current += 1;
    }
  }, [current, maxEntries]);

  const undo = useCallback(() => {
    if (pointer.current <= 0) return;
    pointer.current -= 1;
    const snapshot = stack.current[pointer.current];
    if (snapshot) {
      suppressNextSync.current = true;
      persist(structuredClone(snapshot));
    }
  }, [persist]);

  const redo = useCallback(() => {
    if (pointer.current >= stack.current.length - 1) return;
    pointer.current += 1;
    const snapshot = stack.current[pointer.current];
    if (snapshot) {
      suppressNextSync.current = true;
      persist(structuredClone(snapshot));
    }
  }, [persist]);

  const canUndo = pointer.current > 0;
  const canRedo = pointer.current < stack.current.length - 1;

  return { undo, redo, canUndo, canRedo };
}
