import { NextRequest, NextResponse } from "next/server";
import type { OnboardingProject } from "@/lib/types";
import { NotesExtractionResultSchema } from "@/lib/schemas";

const EXTRACTION_PROMPT = `You are an expert at extracting structured information from unstructured meeting notes, discovery call transcripts, and customer documents for an AI onboarding tool.

Given raw input, extract everything you can identify across discovery, design, and planning artifacts. Return JSON. Only include fields where you have reasonable confidence the value is present — omit anything not mentioned (do NOT invent details).

Return a JSON object with this exact structure:
{
  "discovery": {
    "businessProblem": "string — the core business problem in their words",
    "primaryUseCase": "string — what the AI will do",
    "desiredOutcome": "string — measurable improvement target",
    "currentProcess": "string — how they handle this today",
    "successDefinition": "string — how they'll know the deployment worked",
    "implementationDeadline": "string — date or quarter mentioned",
    "buyerTeam": "string — the team driving procurement",
    "constraints": "string — limits, blockers, dependencies",
    "regulatoryContext": ["GDPR", "FCA", "HIPAA", ...]
  },
  "suggestedStakeholders": [
    { "name": "string", "role": "string", "team": "string", "concerns": ["string"] }
  ],
  "suggestedSystems": [
    { "name": "string", "type": "crm|case_management|document_management|data_warehouse|ticketing|email|chat|core_system|custom|other", "notes": "string — auth, API status, integration constraints, version" }
  ],
  "suggestedDataSources": [
    { "name": "string", "dataType": "documents|tickets|customer_records|transactions|contracts|messages|logs|other", "format": "pdf|docx|csv|xlsx|json|api|database|mixed|unknown", "notes": "string — volume, freshness, quality, access concerns" }
  ],
  "suggestedWorkflows": [
    {
      "name": "string — short step name",
      "description": "string — what happens at this step",
      "ownerTeam": "string — who does it",
      "frequency": "daily|weekly|monthly|ad_hoc",
      "manualEffort": "low|medium|high",
      "painPoints": ["string — frustrations or inefficiencies mentioned"]
    }
  ],
  "suggestedRisks": [
    {
      "title": "string — short risk name",
      "description": "string — what could go wrong",
      "category": "data_readiness|integration|security|stakeholder_alignment|operational_adoption|model_quality|timeline|legal_procurement|support_readiness",
      "severity": "critical|high|medium|low",
      "likelihood": "high|medium|low",
      "mitigation": "string — mitigation idea if discussed"
    }
  ],
  "summary": "One sentence describing what was extracted from these notes"
}

Guidelines:
- For workflows: extract any process steps mentioned (e.g. "analyst reviews case", "supervisor signs off"). Aim for 3-8 steps if a workflow is described.
- For risks: include risks the customer explicitly raised AND obvious risks implied by the context (e.g. if PII data is mentioned, flag a security/privacy risk).
- For regulatory context: include any acronyms (GDPR, FCA, HIPAA, SOC2, FATF, etc.) mentioned.
- Keep all extracted text concise and factual — do NOT embellish, infer beyond what is stated, or pad with generic content.
- Empty arrays are fine; omit fields not mentioned rather than inserting placeholder strings.`;

export async function POST(req: NextRequest) {
  let body: { notes: string; project: OnboardingProject };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { notes } = body;

  if (!notes || notes.trim().length < 20) {
    return NextResponse.json({ error: "notes_too_short" }, { status: 400 });
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
          { role: "user", content: `Extract structured fields from these notes:\n\n${notes}` },
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
      return NextResponse.json({ error: "extraction_failed" });
    }

    return NextResponse.json({ suggestions: validated.data });
  } catch (err) {
    console.error("Notes extraction failed:", err);
    return NextResponse.json({ error: "extraction_failed" });
  }
}
