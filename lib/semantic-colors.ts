// Semantic colour tokens for chips, badges, and dots used across the app.
//
// Before this file, every editor invented its own `*_COLORS` constant —
// SEVERITY_COLORS, PRIORITY_COLORS, STATUS_COLORS, INVOLVEMENT_COLORS,
// INFLUENCE_COLORS, READINESS_DOT, SENSITIVITY_COLOR, COMPLEXITY_COLOR,
// ACCESS_STATUS_COLOR, QUALITY_COLOR, FUTURE_STATE_COLORS, AUTO_COLORS —
// each one a slightly different Tailwind triplet. The result was eight
// near-identical palettes that drifted apart over time.
//
// The 7 chip tokens here cover the severity axis (critical → low → neutral)
// plus two semantic states (info, success). Identity tags that aren't on the
// severity axis (e.g. role palettes for stakeholders, ref-type palettes for
// sources) use ROLE_CHIP / are kept in their own dedicated file.
//
// Phase colours (Discover/Design/Plan/Deliver) live in lib/journey.ts and
// are a SEPARATE palette by design — they're way-finding, not severity.

// Full-weight chip: bg + text + border. The default for severity pills.
export const CHIP = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
  neutral: "bg-muted text-muted-foreground border-muted-foreground/30",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
} as const;

// Paler variant for the second axis on a card — e.g. severity is full-weight,
// likelihood is subtle. Keeps visual hierarchy clear when two chips sit side
// by side.
export const CHIP_SUBTLE = {
  critical: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-green-50 text-green-700 border-green-200",
  neutral: "bg-muted/50 text-muted-foreground/70 border-muted-foreground/10",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
} as const;

// Solid-colour dots (no bg/text). For readiness, source-ref grids, status pips.
// Values match the existing READINESS_DOT + SOURCE_REF dot palette so
// migrating callers does NOT shift any pixels.
export const CHIP_DOT = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
  neutral: "bg-muted-foreground/40",
  info: "bg-blue-500",
  success: "bg-emerald-500",
} as const;

// Identity / role palettes — kept separate from the severity axis above.
// Used by stakeholder involvement, risk status (open/mitigating/accepted),
// and other "this is a tag, not a severity" callsites.
export const ROLE_CHIP = {
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  violet: "bg-violet-100 text-violet-800 border-violet-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  rose: "bg-rose-100 text-rose-800 border-rose-200",
} as const;

export type ChipTone = keyof typeof CHIP;
