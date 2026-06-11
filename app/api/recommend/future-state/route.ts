import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import { RecommendationsResponseSchema } from "@/lib/schemas";
import { guardApiRequest } from "@/lib/api-guards";
import { fenceKbChunks, UNTRUSTED_DOCUMENT_RULE } from "@/lib/prompts";
import {
  PATTERN_BY_ID,
  PATTERNS,
  serializePatternsForPrompt,
} from "@/lib/patterns/future-state-patterns";
import type {
  CustomAutomationPattern,
  OnboardingProject,
  WorkflowStep,
} from "@/lib/types";

// Innovative future-state recommendations grounded in a static pattern
// catalogue. Inputs: workflow steps + customer profile + (optional) KB
// chunks. Output: per-step (or workflow-level) recommendations with
// rationale, confidence, and a one-click apply patch.

export const RECOMMEND_PROMPT_VERSION = "2";

const RECOMMEND_MAX_BODY_BYTES = 1.5 * 1024 * 1024;

const SYSTEM_PROMPT = `You are an expert AI deployment strategist proposing innovative future-state designs for a customer's workflow.

You will be given:
- The customer profile + Discovery context
- The current workflow steps (with painPoints, manualEffort, frequency, etc.)
- An (optional) set of KB_CONTEXT excerpts retrieved from the customer's uploaded documents, each wrapped in an <untrusted_document_excerpt> tag whose id attribute is the chunk id

Your job: produce 1–2 recommendations per step (or fewer if a step doesn't warrant change), plus optionally workflow-level recommendations when no single step is the bottleneck. Each recommendation MUST pick from the AUTOMATION PATTERN CATALOGUE below and explain WHY this pattern fits THIS step.

CATALOGUE
---------
${serializePatternsForPrompt()}
---------

RULES
- For each recommendation set patternId to one of the catalogue ids verbatim. Match the family field accordingly.
- Confidence ∈ [0, 1]: high = explicit pain points + clean automation potential; low = stakeholder concern unresolved, regulatory heavy, or weak grounding.
- valueProposition: one short sentence stating the business impact (e.g. "Cuts manual review by ~70% with traceable second-look").
- rationale: 2-3 sentences tying the recommendation to THIS step's pain points / data / volume / stakeholder context. Cite KB excerpts by the id attribute of their <untrusted_document_excerpt> tag (e.g. "[chunk:abc]") when they support a fact.
- risks: 1-3 short risk titles the pattern typically introduces (you can pull from the catalogue or supplement based on customer context).
- apply.futureState must be one of: human_led, ai_assisted, automated, requires_approval.
- apply.futureStateDescription: 1-2 sentences describing what the future-state step looks like in this customer's context — written as if it will be pasted into the step's description field.
- Set stepId to the matching step.id from the current workflow. For workflow-level recommendations, set stepId = null.
- id: short slug like "rec-1", "rec-2", … Must be unique within the response.
- sourceChunkIds: list of chunk ids cited in the rationale (omit if none).

OUTPUT JSON SHAPE
{
  "recommendations": [
    {
      "id": "rec-1",
      "stepId": "string | null",
      "patternId": "string",
      "patternFamily": "string",
      "title": "string",
      "rationale": "string",
      "confidence": 0.0,
      "valueProposition": "string",
      "risks": ["string"],
      "apply": {
        "futureState": "human_led|ai_assisted|automated|requires_approval",
        "futureStateDescription": "string"
      },
      "sourceChunkIds": ["chunk-id"]
    }
  ]
}

Quality bar: prefer 4-6 high-signal recommendations over 12 generic ones. Empty array is acceptable if the workflow is already optimal.

${UNTRUSTED_DOCUMENT_RULE}`;

function serializeWorkflows(workflows: WorkflowStep[]): string {
  return JSON.stringify(
    workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      ownerTeam: w.ownerTeam,
      currentSystem: w.currentSystem,
      manualEffort: w.manualEffort,
      frequency: w.frequency,
      painPoints: w.painPoints,
      automationPotential: w.automationPotential,
      futureState: w.futureState,
    })),
    null,
    2,
  );
}

function serializeCustomer(project: OnboardingProject): string {
  const c = project.customer;
  const d = project.discovery;
  return JSON.stringify(
    {
      customer: {
        companyName: c.companyName,
        industry: c.industry,
        primaryUseCase: c.primaryUseCase,
        businessProblem: c.businessProblem,
        desiredOutcome: c.desiredOutcome,
        regulatoryContext: c.regulatoryContext,
        technicalMaturity: c.technicalMaturity,
      },
      discovery: {
        currentProcess: d.currentProcess,
        successDefinition: d.successDefinition,
        buyerTeam: d.buyerTeam,
        knownRisks: d.knownRisks,
      },
      stakeholderRoles: project.stakeholders.map((s) => s.role).filter(Boolean),
    },
    null,
    2,
  );
}

function serializeKbChunks(
  chunks: { id: string; text: string; label?: string }[],
): string {
  if (chunks.length === 0) return "(none)";
  return fenceKbChunks(chunks, 3500);
}

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > RECOMMEND_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > RECOMMEND_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let parsed: {
    project?: OnboardingProject;
    workflows?: WorkflowStep[];
    kbContextChunks?: { id: string; text: string; label?: string }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { project, workflows, kbContextChunks = [] } = parsed;
  const customPatterns: CustomAutomationPattern[] =
    project?.customPatterns ?? [];
  if (!project || !workflows || workflows.length < 1) {
    return NextResponse.json(
      { error: "invalid_input", message: "Need a project with workflows" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const customCatalogueBlock =
    customPatterns.length > 0
      ? `\nCUSTOM_PATTERNS (project-specific, treat as first-class catalogue entries):\n${customPatterns
          .map(
            (p) =>
              `## ${p.name} (id: ${p.id}, family: ${p.family})\n${p.shortDescription}\nWHEN: ${(p.whenToUse ?? []).map((w) => `• ${w}`).join("; ")}\nARCH: ${p.exampleArchitecture}\nFUTURE_STATE_ENUM: ${p.recommendedFutureState}`,
          )
          .join("\n\n")}`
      : "";

  const userPrompt = [
    `CUSTOMER:\n${serializeCustomer(project)}`,
    `\nCURRENT_WORKFLOW (${workflows.length} step${workflows.length !== 1 ? "s" : ""}):\n${serializeWorkflows(workflows)}`,
    customCatalogueBlock,
    `\nKB_CONTEXT:\n${serializeKbChunks(kbContextChunks)}`,
    `\nProduce future-state recommendations grounded in the catalogue. Cite chunk ids in rationale where applicable.`,
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
        ...completionParams(MODELS.chat, { temperature: 0.4, maxTokens: 4000 }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const parsedJson = JSON.parse(content);
    const validated = RecommendationsResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("recommend schema validation failed:", validated.error);
      return NextResponse.json(
        {
          error: "generation_failed",
          message: `Response did not match schema: ${validated.error.issues[0]?.message ?? "validation error"}`,
        },
        { status: 502 },
      );
    }

    // Clamp patternId / family to known catalogue (built-in + custom).
    // LLM occasionally invents IDs — fall back to first built-in if so.
    const customById = new Map(customPatterns.map((p) => [p.id, p]));
    const cleaned = validated.data.recommendations.map((rec) => {
      const builtIn = PATTERN_BY_ID[rec.patternId];
      const custom = customById.get(rec.patternId);
      if (builtIn) {
        return { ...rec, patternId: builtIn.id, patternFamily: builtIn.family };
      }
      if (custom) {
        return { ...rec, patternId: custom.id, patternFamily: custom.family };
      }
      return {
        ...rec,
        patternId: PATTERNS[0].id,
        patternFamily: PATTERNS[0].family,
      };
    });

    return NextResponse.json({ recommendations: cleaned });
  } catch (err) {
    // err.message can carry upstream/model fragments — keep it server-side.
    console.error("Future-state recommendation failed:", err);
    return NextResponse.json(
      { error: "generation_failed", message: "Generation failed" },
      { status: 502 },
    );
  }
}
