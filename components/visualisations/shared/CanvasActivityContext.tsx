"use client";

import { createContext, useContext, type ReactNode } from "react";

// Workflow tab panels stay mounted (CSS-hidden) so canvases keep their
// viewport, selection, and undo history across switches — but window-level
// shortcut listeners must not fire for hidden maps. The tab host provides
// this flag; canvases rendered outside a tab host default to active.
const CanvasActivityContext = createContext(true);

export function CanvasActivityProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <CanvasActivityContext.Provider value={active}>
      {children}
    </CanvasActivityContext.Provider>
  );
}

export function useCanvasActive(): boolean {
  return useContext(CanvasActivityContext);
}
