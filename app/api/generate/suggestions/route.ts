import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import { NotesExtractionResultSchema } from "@/lib/schemas";
import { guardApiRequest, parseBoundedJson } from "@/lib/api-guards";
import type { OnboardingProject } from "@/lib/types";

// Generate suggestions from Discovery state (rather than from free-text
// notes). Reuses the same NotesExtractionResult schema + NotesDiffPanel
// review UI so the merge path is identical — just a different prompt
// source. Output structure matches /api/extract/notes so the existing
// NotesDiffPanel renders without changes.

export const SUGGESTIONS_PROMPT_VERSION = "1";

const SUGGESTIONS_SYSTEM_PROMPT = `You are an expert AI deployment strategist helping a forward-deployed engineer scope a customer onboarding.

The user has filled in Discovery + Customer Profile data. Your job: infer the typical workflows, systems, data sources, stakeholders, and risks that a customer in this industry, with this business problem, would have. You are NOT extracting from a transcript — you are inferring plausible defaults the user can review and accept.

CRITICAL RULES
- Use the customer's industry + regulatory context + business problem as primary signal.
- Suggest entries that are SPECIFIC to this customer's domain (e.g. for fintech AML: suggest Actimize / SAR filing workflow / FCA / MLRO role — not generic "case management system").
- 4–8 entries per category is the right range. Quality over quantity.
- If you can't infer reasonable entries for a category, return an empty array — don't pad with generic placeholders.
- Never invent names of people. For stakeholders, leave name="" and fill role + team only — the user will add real names.

OUTPUT SHAPE — return a JSON object with these top-level keys (all optional):

\`suggestedStakeholders\` — array of: { name (always ""), role, team, concerns: string[] }

\`suggestedSystems\` — array of: { name, type, notes }
  - type ∈ {crm, case_management, document_management, data_warehouse, ticketing, email, chat, core_system, custom, other}

\`suggestedDataSources\` — array of: { name, dataType, format, notes }
  - dataType ∈ {documents, tickets, customer_records, transactions, contracts, messages, logs, other}
  - format ∈ {pdf, docx, csv, xlsx, json, api, database, mixed, unknown}

\`suggestedWorkflows\` — array of: { name, description, ownerTeam, frequency, manualEffort, painPoints: string[] }
  - frequency ∈ {daily, weekly, monthly, ad_hoc}
  - manualEffort ∈ {low, medium, high}

\`suggestedRisks\` — array of: { title, description, category, severity, likelihood, mitigation }
  - category ∈ {data_readiness, integration, security, stakeholder_alignment, operational_adoption, model_quality, timeline, legal_procurement, support_readiness}
  - severity ∈ {critical, high, medium, low}
  - likelihood ∈ {high, medium, low}

\`summary\` — REQUIRED. One sentence (≤200 chars) describing what you inferred.

GUIDELINES
- Scope by target tab: if the request specifies a single target (workflows / systems / stakeholders / risks), return ONLY that section + summary. Other sections should be omitted or empty.
- For risks: anchor in this customer's regulatory context + technical maturity + integration complexity.
- For workflows: end-to-end process for the primaryUseCase — 4-6 steps from intake to completion.
- For stakeholders: cover sponsor / decision-maker / technical owner / end user at minimum.`;

function serializeDiscoveryContext(project: OnboardingProject): string {
  const c = project.customer;
  const d = project.discovery;
  const existingSystemNames = project.systems
    .map((s) => s.name)
    .filter(Boolean);
  const existingWorkflowNames = project.workflows
    .map((w) => w.name)
    .filter(Boolean);
  const existingStakeholderRoles = project.stakeholders
    .map((s) => s.role)
    .filter(Boolean);

  return JSON.stringify(
    {
      customer: {
        companyName: c.companyName,
        industry: c.industry,
        companySize: c.companySize,
        primaryUseCase: c.primaryUseCase,
        businessProblem: c.businessProblem,
        desiredOutcome: c.desiredOutcome,
        urgency: c.urgency,
        regulatoryContext: c.regulatoryContext,
        technicalMaturity: c.technicalMaturity,
      },
      discovery: {
        currentProcess: d.currentProcess,
        usersAffected: d.usersAffected,
        constraints: d.constraints,
        knownRisks: d.knownRisks,
        successDefinition: d.successDefinition,
        buyerTeam: d.buyerTeam,
        riskLevel: d.riskLevel,
        implementationDeadline: d.implementationDeadline,
      },
      existing: {
        systemNames: existingSystemNames,
        workflowNames: existingWorkflowNames,
        stakeholderRoles: existingStakeholderRoles,
      },
    },
    null,
    2,
  );
}

type Target = "workflows" | "systems" | "stakeholders" | "risks" | "all";

const VALID_TARGETS: Target[] = [
  "workflows",
  "systems",
  "stakeholders",
  "risks",
  "all",
];

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;
  const parsed = await parseBoundedJson<{
    project?: OnboardingProject;
    target?: Target;
  }>(req);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const { project, target = "all" } = parsed.data ?? {};
  if (!project || !project.customer || !project.discovery) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  if (!VALID_TARGETS.includes(target)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (
    !project.customer.companyName ||
    !project.customer.businessProblem ||
    !project.discovery.currentProcess
  ) {
    return NextResponse.json(
      { error: "insufficient_discovery" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const userPrompt =
    target === "all"
      ? `Infer typical workflows, systems, data sources, stakeholders, and risks for this customer:\n\n${serializeDiscoveryContext(project)}`
      : `Infer typical ${target} for this customer. Return ONLY the suggested${target.charAt(0).toUpperCase()}${target.slice(1)} field (and summary). Omit all other suggestion categories.\n\n${serializeDiscoveryContext(project)}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.chat,
        messages: [
          { role: "system", content: SUGGESTIONS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        ...completionParams(MODELS.chat, { temperature: 0.3, maxTokens: 4000 }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const parsedJson = JSON.parse(content);
    const validated = NotesExtractionResultSchema.safeParse(parsedJson);
    if (!validated.success) {
      // Detail goes to the server log only — schema internals and upstream
      // error text must not reach the client.
      console.error("Suggestions schema validation failed:", validated.error);
      return NextResponse.json(
        {
          error: "generation_failed",
          message: "Model response did not match the expected schema",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ suggestions: validated.data });
  } catch (err) {
    console.error("Suggestions generation failed:", err);
    return NextResponse.json(
      {
        error: "generation_failed",
        message: "Suggestions generation failed",
      },
      { status: 502 },
    );
  }
}
