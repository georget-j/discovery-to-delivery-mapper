// Single source of truth for the color semantics of each SourceRef type.
// Used by EvidenceTrail (chips on Requirements/Risks), ArtifactSourcesPanel
// (dots in the right panel on Outputs), and CoverageMatrix (row dots).
//
// Each ref type gets its OWN distinct color — earlier versions reused red
// for both `stakeholder_concern` and `regulatory_context`, which made the
// sources panel ambiguous.

import type { SourceRefType } from "./types";

export type SourceRefColor = {
  label: string; // Human-readable type name
  dot: string; // Tailwind solid-color class for dots
  chipClass: string; // Tailwind background+text+border for chips
  borderColor: string; // Tailwind ring/border color (used for hollow dots)
};

export const SOURCE_REF_COLORS: Record<SourceRefType, SourceRefColor> = {
  workflow_step: {
    label: "Workflow step",
    dot: "bg-blue-500",
    chipClass: "bg-blue-50 text-blue-800 border-blue-200",
    borderColor: "border-blue-500",
  },
  system: {
    label: "System",
    dot: "bg-emerald-500",
    chipClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    borderColor: "border-emerald-500",
  },
  data_source: {
    label: "Data source",
    dot: "bg-cyan-500",
    chipClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
    borderColor: "border-cyan-500",
  },
  stakeholder: {
    label: "Stakeholder",
    dot: "bg-purple-500",
    chipClass: "bg-purple-50 text-purple-800 border-purple-200",
    borderColor: "border-purple-500",
  },
  // Stakeholder concerns drive risk entries. Distinct from raw stakeholders
  // (purple) and from regulatory tags (rose) — uses indigo so all three
  // people-adjacent categories are visually separable.
  stakeholder_concern: {
    label: "Concern",
    dot: "bg-indigo-500",
    chipClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    borderColor: "border-indigo-500",
  },
  discovery_field: {
    label: "Discovery",
    dot: "bg-slate-500",
    chipClass: "bg-slate-50 text-slate-700 border-slate-200",
    borderColor: "border-slate-500",
  },
  session: {
    label: "Session",
    dot: "bg-amber-500",
    chipClass: "bg-amber-50 text-amber-800 border-amber-200",
    borderColor: "border-amber-500",
  },
  // Regulatory tags get rose (not pure red) to keep the destructive-action
  // red exclusive to delete buttons and critical severity.
  regulatory_context: {
    label: "Regulation",
    dot: "bg-rose-500",
    chipClass: "bg-rose-50 text-rose-800 border-rose-200",
    borderColor: "border-rose-500",
  },
  // Pass 4: knowledge-base chunks — teal, distinct from session amber.
  knowledge_base_chunk: {
    label: "Knowledge base",
    dot: "bg-teal-500",
    chipClass: "bg-teal-50 text-teal-800 border-teal-200",
    borderColor: "border-teal-500",
  },
};

// Maps a SourceRef type to the workspace tab where the source lives.
// Used by EvidenceTrail and ArtifactSourcesPanel to make refs clickable.
export const TAB_FOR_SOURCE_REF: Record<SourceRefType, string> = {
  workflow_step: "workflow",
  system: "systems",
  data_source: "systems",
  stakeholder: "discovery",
  stakeholder_concern: "risks",
  discovery_field: "discovery",
  session: "",
  regulatory_context: "discovery",
  knowledge_base_chunk: "intake",
};
