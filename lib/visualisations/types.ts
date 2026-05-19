// Shared primitives reused across all 6 visualisations.

export type Position = { x: number; y: number };

export type Lane = {
  id: string;
  title: string;
  description?: string;
};

export type EdgeStyle = "solid" | "dashed";

export type GenerationSource = "ai" | "manual" | "template_fallback";
