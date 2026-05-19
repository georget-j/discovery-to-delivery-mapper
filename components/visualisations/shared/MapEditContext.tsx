"use client";

import { createContext, useContext, type ReactNode } from "react";

// Lightweight context exposed by canvases so node renderers can patch their own
// data directly (e.g. inline-edit a title) without prop drilling.

type Ctx = {
  patchNode: (id: string, patch: Record<string, unknown>) => void;
};

const MapEditContext = createContext<Ctx | null>(null);

export function MapEditProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <MapEditContext.Provider value={value}>{children}</MapEditContext.Provider>;
}

export function useMapEdit(): Ctx {
  const ctx = useContext(MapEditContext);
  if (!ctx) {
    // Permissive no-op for SSR / tests; production paths always provide a value.
    return { patchNode: () => {} };
  }
  return ctx;
}
