"use client";

import { useEffect } from "react";

type Handlers = {
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onAutoLayout?: () => void;
  onNudge?: (dx: number, dy: number) => void;
  onEscape?: () => void;
};

export function useCanvasShortcuts(
  handlers: Handlers,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      // Don't intercept when focus is in form fields.
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      )
        return;

      const meta = e.metaKey || e.ctrlKey;

      // Only preventDefault when a handler is actually wired — the browser
      // default (e.g. ⌘A select-all, arrow-key scrolling) must survive otherwise.
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!handlers.onUndo) return;
        e.preventDefault();
        handlers.onUndo();
        return;
      }
      if (
        meta &&
        ((e.key.toLowerCase() === "z" && e.shiftKey) ||
          e.key.toLowerCase() === "y")
      ) {
        if (!handlers.onRedo) return;
        e.preventDefault();
        handlers.onRedo();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        if (!handlers.onDuplicate) return;
        e.preventDefault();
        handlers.onDuplicate();
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        if (!handlers.onSelectAll) return;
        e.preventDefault();
        handlers.onSelectAll();
        return;
      }
      if (meta && e.key.toLowerCase() === "l") {
        if (!handlers.onAutoLayout) return;
        e.preventDefault();
        handlers.onAutoLayout();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!handlers.onDelete) return;
        e.preventDefault();
        handlers.onDelete();
        return;
      }
      if (e.key === "Escape") {
        handlers.onEscape?.();
        return;
      }
      if (!handlers.onNudge) return;
      const step = e.shiftKey ? 1 : 10;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handlers.onNudge(0, -step);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        handlers.onNudge(0, step);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlers.onNudge(-step, 0);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handlers.onNudge(step, 0);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, handlers]);
}
