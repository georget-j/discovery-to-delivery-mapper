import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import {
  FromKbRequestSchema,
  NotesExtractionResultSchema,
} from "@/lib/schemas";
import { guardApiRequest, parseBoundedJson } from "@/lib/api-guards";
import { fenceKbChunks, UNTRUSTED_DOCUMENT_RULE } from "@/lib/prompts";
import type { OnboardingProject } from "@/lib/types";

// Generate suggestions GROUNDED in retrieved knowledge-base chunks. The
// client (intake page or per-tab GenerateButton) does retrieval and posts
// the top-K chunks alongside the project. We feed both to gpt-4o-mini and
// ask for the same NotesExtractionResult shape so NotesDiffPanel +
// applySuggestionsToProject work unchanged. Citations come back as a
// map of suggestion-row-id → chunk ids so the merge layer can stamp
// sourceRefs.

export const FROM_KB_PROMPT_VERSION = "2";

// Override the 256KB body cap — KB context chunks can push past that.
const FROM_KB_MAX_BODY_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

type Target =
  | "discovery"
  | "workflows"
  | "systems"
  | "stakeholders"
  | "risks"
  | "all";
const VALID_TARGETS: Target[] = [
  "discovery",
  "workflows",
  "systems",
  "stakeholders",
  "risks",
  "all",
];

const SYSTEM_PROMPT = `You are an expert AI deployment strategist helping a forward-deployed engineer scope a customer onboarding.

You are given:
- The customer profile + Discovery state captured so far
- KB_CONTEXT: excerpts retrieved from documents the user uploaded, each wrapped in an <untrusted_document_excerpt> tag whose id attribute is the chunk id

Your job: extract concrete, grounded entries that the user can review for one or more of: Discovery fields, Workflows, Systems, Data Sources, Stakeholders, Risks.

CRITICAL RULES
- Only assert facts that the KB excerpts support, OR that are widely true given the customer's industry + business problem. Do NOT invent specific tools, names, or numbers that aren't in the excerpts.
- Quote terms verbatim when they appear in the excerpts (system names, team names, regulatory tags).
- If a category has no KB support and no reasonable inference, return an empty array — don't pad.
- Never invent stakeholder NAMES. Leave name="" and fill role + team only.

OUTPUT SHAPE — return a JSON object with these top-level keys (all optional EXCEPT summary):

\`discovery\`: Partial discovery patch — businessProblem, primaryUseCase, desiredOutcome, currentProcess, successDefinition, implementationDeadline, buyerTeam, constraints, regulatoryContext (string array).

\`suggestedStakeholders\`: array of { name (""), role, team, concerns: string[] }

\`suggestedSystems\`: array of { name, type, notes }
  - type ∈ {crm, case_management, document_management, data_warehouse, ticketing, email, chat, core_system, custom, other}

\`suggestedDataSources\`: array of { name, dataType, format, notes }
  - dataType ∈ {documents, tickets, customer_records, transactions, contracts, messages, logs, other}
  - format ∈ {pdf, docx, csv, xlsx, json, api, database, mixed, unknown}

\`suggestedWorkflows\`: array of { name, description, ownerTeam, frequency, manualEffort, painPoints: string[] }
  - frequency ∈ {daily, weekly, monthly, ad_hoc}
  - manualEffort ∈ {low, medium, high}

\`suggestedRisks\`: array of { title, description, category, severity, likelihood, mitigation }
  - category ∈ {data_readiness, integration, security, stakeholder_alignment, operational_adoption, model_quality, timeline, legal_procurement, support_readiness}
  - severity ∈ {critical, high, medium, low}
  - likelihood ∈ {high, medium, low}

\`summary\`: REQUIRED. One sentence (≤200 chars) summarizing what you extracted.

TARGET SCOPING
- If target == "discovery": fill the \`discovery\` field, leave the others empty.
- If target == "workflows" | "systems" | "stakeholders" | "risks": return ONLY the matching suggestedX field + summary.
- If target == "all": fill any category the KB supports.

${UNTRUSTED_DOCUMENT_RULE}`;

function serializeContext(project: OnboardingProject): string {
  const c = project.customer;
  const d = project.discovery;
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
        successDefinition: d.successDefinition,
        buyerTeam: d.buyerTeam,
        constraints: d.constraints,
        knownRisks: d.knownRisks,
      },
      existing: {
        systemNames: project.systems.map((s) => s.name).filter(Boolean),
        workflowNames: project.workflows.map((w) => w.name).filter(Boolean),
        stakeholderRoles: project.stakeholders
          .map((s) => s.role)
          .filter(Boolean),
      },
    },
    null,
    2,
  );
}

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;

  // Bounded parse with the larger ceiling.
  const parsed = await parseBoundedJson<{
    project?: OnboardingProject;
    target?: Target;
    contextChunks?: { id: string; text: string; label?: string }[];
  }>(req, FROM_KB_MAX_BODY_BYTES);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }

  const { project, target = "all", contextChunks = [] } = parsed.data;
  if (!project || !project.customer || !project.discovery) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  if (!VALID_TARGETS.includes(target)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (contextChunks.length === 0) {
    return NextResponse.json({ error: "no_context" }, { status: 400 });
  }
  if (contextChunks.length > 40) {
    return NextResponse.json({ error: "too_much_context" }, { status: 400 });
  }

  // The wire shape carries the full project; the schema owns the rest.
  // Rejects non-string chunk ids/text before they reach the prompt builder.
  const shaped = FromKbRequestSchema.safeParse({
    projectId: project.id,
    target,
    contextChunks,
  });
  if (!shaped.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const userPrompt = [
    `TARGET: ${target}`,
    `\nPROJECT_CONTEXT:\n${serializeContext(project)}`,
    `\nKB_CONTEXT:\n${fenceKbChunks(contextChunks, 4000)}`,
    `\nProduce a NotesExtractionResult JSON object that reflects everything the KB supports for this target.`,
  ].join("\n");

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
          { role: "system", content: SYSTEM_PROMPT },
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
      console.error("from-kb schema validation failed:", validated.error);
      return NextResponse.json(
        {
          error: "generation_failed",
          message: `Response did not match schema: ${validated.error.issues[0]?.message ?? "validation error"}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      suggestions: validated.data,
      chunkIds: contextChunks.map((c) => c.id),
    });
  } catch (err) {
    // err.message can carry upstream/model fragments — keep it server-side.
    console.error("from-kb generation failed:", err);
    return NextResponse.json(
      { error: "generation_failed", message: "Generation failed" },
      { status: 502 },
    );
  }
}
