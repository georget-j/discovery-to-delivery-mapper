import type { ArtifactReadiness } from "@/lib/artifact-sources";
import { CHIP_DOT } from "@/lib/semantic-colors";

// Shared presentation layer for artifact-readiness signals.
// Thresholds mirror getArtifactReadiness() in artifact-sources.ts — keep in sync.
export const READINESS_LABEL: Record<ArtifactReadiness, string> = {
  rich: "Rich",
  usable: "Usable",
  thin: "Thin",
  empty: "No inputs",
};

export const READINESS_DOT: Record<ArtifactReadiness, string> = {
  rich: CHIP_DOT.success,
  usable: CHIP_DOT.medium,
  thin: CHIP_DOT.neutral,
  empty: CHIP_DOT.critical,
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
