import type { ArtifactReadiness } from "@/lib/artifact-sources";

// Shared presentation layer for artifact-readiness signals.
// Thresholds mirror getArtifactReadiness() in artifact-sources.ts — keep in sync.
export const READINESS_LABEL: Record<ArtifactReadiness, string> = {
  rich: "Rich",
  usable: "Usable",
  thin: "Thin",
  empty: "No inputs",
};

export const READINESS_DOT: Record<ArtifactReadiness, string> = {
  rich: "bg-emerald-500",
  usable: "bg-amber-500",
  thin: "bg-muted-foreground/40",
  empty: "bg-red-500",
};

export const READINESS_DESCRIPTION: Record<ArtifactReadiness, string> = {
  rich: "10+ source inputs — confident generation",
  usable: "4–9 inputs — solid, may have small gaps",
  thin: "1–3 inputs — generation will be sparse",
  empty: "0 inputs — nothing feeds this artifact yet",
};

export function readinessTooltip(readiness: ArtifactReadiness): string {
  return `${READINESS_LABEL[readiness]} — ${READINESS_DESCRIPTION[readiness]}`;
}
