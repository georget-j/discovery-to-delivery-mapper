// Per-industry voice / tone briefs prepended to the artifact-generation
// system prompt. Keeps generated copy grounded in the language an industry
// stakeholder would actually use, instead of a generic "tech vendor" voice.

const PERSONAE: Record<string, string> = {
  fintech: `INDUSTRY VOICE: fintech / financial services.
- Prefer "control owner" over "team lead" and "first line / second line" terminology where applicable.
- Foreground audit-trail, model-explainability, and traceability for regulator review.
- Lean on FCA / FATF / MiFID II / PSD2 framings; spell out the regulator on first mention.
- Treat any AI decision as audit-loggable by default; avoid framings that sound autonomous without oversight.
- Tone: precise, cautious, defensible. No marketing fluff.`,

  legaltech: `INDUSTRY VOICE: legaltech.
- Use "matter" not "ticket" or "case"; use "counsel" not "user".
- Foreground citation grounding, hallucination guardrails, and attorney–client privilege.
- Use SRA, ICO, GDPR framings where regulation is referenced; never imply replacing legal judgement.
- Treat anything client-facing as needing partner sign-off by default.
- Tone: measured, conservative, precise. Avoid breezy productivity-tool language.`,

  healthcare: `INDUSTRY VOICE: healthcare / health-tech.
- Use "clinician" not "user"; "encounter" not "session"; respect care-team hierarchy.
- Foreground HIPAA, GDPR, ISO 13485, patient safety, and clinical-validation pathways.
- Treat any clinical decision as needing physician oversight; avoid autonomous-AI framings.
- Distinguish PHI from non-PHI data flows explicitly.
- Tone: clinical, careful, patient-first. Avoid Silicon Valley shorthand.`,

  insurance: `INDUSTRY VOICE: insurance.
- Use "underwriter", "claims handler", "loss adjuster" — specific roles.
- Foreground fairness, model explainability for declines, and regulator framings (FCA, DORA).
- Cite reserve impact, loss-ratio sensitivity, and customer-fairness obligations where relevant.
- Tone: measured, actuarial. Quantitative claims need a stated baseline.`,

  industrial: `INDUSTRY VOICE: industrial / manufacturing / operations.
- Use "line", "shift", "throughput", "OEE", "MTTR", "MTBF" naturally where relevant.
- Foreground uptime, safety (ISO 13849), and operator workflow continuity.
- Treat AI as augmenting, not replacing, operator judgement.
- Tone: practical, plant-floor pragmatic, KPI-driven.`,

  enterprise_saas: `INDUSTRY VOICE: enterprise SaaS.
- Use product-led language: "activation", "expansion", "stickiness", "TTFV".
- Foreground self-serve onboarding, in-product UX, and account-level rollout patterns.
- Tone: confident, outcomes-oriented, but still concrete on integration and security.`,

  public_sector: `INDUSTRY VOICE: public sector / government.
- Use "service user" or "citizen", "case worker", "frontline officer".
- Foreground GDPR, FOI Act, transparency, accountability, and bias mitigation.
- Treat decisions affecting citizens as needing human accountability.
- Tone: clear, neutral, service-led. Avoid commercial language.`,
};

export function industryVoice(industry: string | undefined): string {
  if (!industry) return "";
  return PERSONAE[industry] ?? "";
}
