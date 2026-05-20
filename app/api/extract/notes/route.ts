import { NextRequest, NextResponse } from "next/server";
import { NotesExtractionResultSchema } from "@/lib/schemas";
import { parseBoundedJson } from "@/lib/api-guards";

// Notes have their own ceiling — longer than the project-shape cap, since a
// pasted transcript may legitimately be 100KB+, but capped to avoid burning
// tokens on absurd inputs.
const MAX_NOTES_CHARS = 80_000;

// Bump when the prompt body changes meaningfully — read by no consumers today
// but lets us version stored extractions later.
export const EXTRACTION_PROMPT_VERSION = "2";

const EXTRACTION_PROMPT = `You are an expert at extracting structured information from unstructured meeting notes, discovery call transcripts, and customer documents for an AI onboarding tool.

Given raw input, extract everything you can identify across discovery, design, and planning artifacts. Return a JSON object. Only include fields where you have reasonable confidence the value is present — omit anything not mentioned. NEVER invent details, names, dates, or numbers not present in the input.

OUTPUT SHAPE — return a JSON object with these top-level keys (all optional except summary):

\`discovery\` — object with one or more of:
  - businessProblem: the core business problem in the customer's own words
  - primaryUseCase: what the AI will do
  - desiredOutcome: measurable improvement target
  - currentProcess: how they handle this today
  - successDefinition: how they'll know the deployment worked
  - implementationDeadline: a date or quarter mentioned (e.g. "Q3 2026" or "2026-09-30")
  - buyerTeam: the team driving procurement
  - constraints: limits, blockers, dependencies
  - regulatoryContext: array of acronyms mentioned (e.g. ["GDPR", "FCA", "HIPAA"])

\`suggestedStakeholders\` — array of: { name, role, team, concerns: string[] }

\`suggestedSystems\` — array of: { name, type, notes }
  - type ∈ {crm, case_management, document_management, data_warehouse, ticketing, email, chat, core_system, custom, other}
  - notes: auth, API status, integration constraints, version

\`suggestedDataSources\` — array of: { name, dataType, format, notes }
  - dataType ∈ {documents, tickets, customer_records, transactions, contracts, messages, logs, other}
  - format ∈ {pdf, docx, csv, xlsx, json, api, database, mixed, unknown}
  - notes: volume, freshness, quality, access concerns

\`suggestedWorkflows\` — array of: { name, description, ownerTeam, frequency, manualEffort, painPoints: string[] }
  - frequency ∈ {daily, weekly, monthly, ad_hoc}
  - manualEffort ∈ {low, medium, high}

\`suggestedRisks\` — array of: { title, description, category, severity, likelihood, mitigation }
  - category ∈ {data_readiness, integration, security, stakeholder_alignment, operational_adoption, model_quality, timeline, legal_procurement, support_readiness}
  - severity ∈ {critical, high, medium, low}
  - likelihood ∈ {high, medium, low}

\`suggestedActionItems\` — array of: { title, assignee, dueDate?, urgency }
  - title: imperative voice (e.g. "Send DPA template to legal")
  - assignee: a person or team name
  - dueDate: ISO date YYYY-MM-DD, or a quarter ("Q3 2026"), or omit if not stated
  - urgency ∈ {high, medium, low}

\`summary\` — REQUIRED. One sentence (≤200 chars) describing what was extracted.

GUIDELINES
- For workflows: extract any process steps mentioned ("analyst reviews case", "supervisor signs off"). 3–8 steps if a workflow is described.
- For risks: include explicit + obvious-implied risks (e.g. PII mentioned → flag security/privacy risk).
- For regulatory context: include acronyms (GDPR, FCA, HIPAA, SOC2, FATF, MiFID, DORA, PSD2).
- For action items: signal phrases include "we'll send", "Sarah will", "by next Tuesday", "next steps", "action item". Every item needs a title and assignee — infer from team context if the assignee isn't named. Only include dueDate if explicitly mentioned.
- Concise and factual. No embellishment, no inference beyond what's stated, no generic padding.
- Empty arrays are fine; omit fields not mentioned rather than inserting placeholder strings.`;

export async function POST(req: NextRequest) {
  const parsed = await parseBoundedJson<{ notes?: unknown }>(req);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const notes = parsed.data?.notes;
  if (typeof notes !== "string" || notes.trim().length < 20) {
    return NextResponse.json({ error: "notes_too_short" }, { status: 400 });
  }
  if (notes.length > MAX_NOTES_CHARS) {
    return NextResponse.json({ error: "notes_too_long" }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Extract structured fields from these notes:\n\n${notes}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const parsed = JSON.parse(content);
    const validated = NotesExtractionResultSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("Extraction schema validation failed:", validated.error);
      return NextResponse.json({
        error: "extraction_failed",
        message: `Response did not match expected schema: ${validated.error.issues[0]?.message ?? "validation error"}`,
      });
    }

    return NextResponse.json({ suggestions: validated.data });
  } catch (err) {
    console.error("Notes extraction failed:", err);
    return NextResponse.json({
      error: "extraction_failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
