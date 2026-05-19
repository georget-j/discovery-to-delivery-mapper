"use client";

import { useEffect, useRef } from "react";

export type ContextMenuItem =
  | { type: "item"; label: string; shortcut?: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { type: "separator" }
  | { type: "submenu"; label: string; items: ContextMenuItem[] };

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function CanvasContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Use setTimeout to avoid the click that opened the menu also closing it.
    const id = setTimeout(() => {
      window.addEventListener("mousedown", handler);
      window.addEventListener("keydown", escHandler);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", escHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ left: x, top: y, position: "fixed", zIndex: 100 }}
      className="min-w-[200px] rounded-md border bg-background shadow-lg py-1"
      role="menu"
    >
      {items.map((it, i) => {
        if (it.type === "separator") {
          return <div key={i} className="border-t my-1" />;
        }
        if (it.type === "submenu") {
          return (
            <div key={i} className="relative group px-3 py-1.5 text-xs cursor-default hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <span>{it.label}</span>
                <span className="text-muted-foreground">▸</span>
              </div>
              <div className="hidden group-hover:block absolute left-full top-0 ml-1 min-w-[180px] rounded-md border bg-background shadow-lg py-1">
                {it.items.map((sub, j) => sub.type === "item" ? (
                  <button
                    key={j}
                    type="button"
                    onClick={() => { sub.onClick(); onClose(); }}
                    disabled={sub.disabled}
                    className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sub.label}
                  </button>
                ) : null)}
              </div>
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => { it.onClick(); onClose(); }}
            disabled={it.disabled}
            className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              it.danger ? "text-red-700 hover:bg-red-50" : "hover:bg-muted/50"
            }`}
          >
            <span>{it.label}</span>
            {it.shortcut && <span className="text-[10px] text-muted-foreground ml-3">{it.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
