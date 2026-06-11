import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import type { OnboardingProject, GeneratedArtifacts } from "@/lib/types";
import { buildArtifactPrompt } from "@/lib/prompts";
import { GeneratedArtifactsSchema } from "@/lib/schemas";
import { generateTemplateArtifacts } from "@/lib/artifact-templates";
import { hashGenerationInputs } from "@/lib/artifact-helpers";
import { guardApiRequest, looksLikeProject } from "@/lib/api-guards";
import { industryVoice } from "@/lib/industry-personae";

// Stamp every generated GeneratedArtifacts blob with the input hash + timestamp
// so the Outputs page can detect when project inputs have drifted since.
function stamp(
  artifacts: GeneratedArtifacts,
  project: OnboardingProject,
): GeneratedArtifacts {
  return {
    ...artifacts,
    derivedFromHash: hashGenerationInputs(project),
    generatedAt: new Date().toISOString(),
  };
}

// Larger ceiling than the shared 256KB cap because the optional KB context
// (retrieved document excerpts) rides along with the project.
const ARTIFACTS_MAX_BODY_BYTES = 1.5 * 1024 * 1024;

type KbContextChunk = { id: string; text: string; label?: string };

// Each chunk is interpolated verbatim into the prompt, so per-chunk text and
// label must be capped or a crafted payload could amplify tokens well past
// what the body-size limit implies.
const KB_CHUNK_MAX_TEXT_CHARS = 4000;
const KB_CHUNK_MAX_LABEL_CHARS = 200;

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > ARTIFACTS_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > ARTIFACTS_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Accept either a raw project (legacy) or { project, kbContext }.
  let project: OnboardingProject;
  let kbContext: KbContextChunk[] = [];
  const maybeWrapped = body as { project?: unknown; kbContext?: unknown };
  if (maybeWrapped && looksLikeProject(maybeWrapped.project)) {
    project = maybeWrapped.project as OnboardingProject;
    if (Array.isArray(maybeWrapped.kbContext)) {
      kbContext = (maybeWrapped.kbContext as unknown[])
        .filter(
          (c): c is KbContextChunk =>
            !!c &&
            typeof c === "object" &&
            typeof (c as KbContextChunk).id === "string" &&
            typeof (c as KbContextChunk).text === "string",
        )
        .slice(0, 16)
        .map((c) => ({
          id: c.id,
          text: c.text.slice(0, KB_CHUNK_MAX_TEXT_CHARS),
          ...(typeof c.label === "string"
            ? { label: c.label.slice(0, KB_CHUNK_MAX_LABEL_CHARS) }
            : {}),
        }));
    }
  } else if (looksLikeProject(body)) {
    project = body as OnboardingProject;
  } else {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // No API key — return deterministic template artifacts
    const artifacts = stamp(generateTemplateArtifacts(project), project);
    return NextResponse.json({ artifacts, source: "template" });
  }

  try {
    const { system, user } = buildArtifactPrompt(project, kbContext);
    const voice = industryVoice(project.customer.industry);
    const systemWithVoice = voice ? `${voice}\n\n${system}` : system;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.chat,
        messages: [
          { role: "system", content: systemWithVoice },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        ...completionParams(MODELS.chat, { temperature: 0.3, maxTokens: 12000 }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const parsed = JSON.parse(content);
    const validated = GeneratedArtifactsSchema.safeParse(parsed);

    if (!validated.success) {
      // Fall back to templates if AI response doesn't match schema
      const artifacts = stamp(generateTemplateArtifacts(project), project);
      return NextResponse.json({ artifacts, source: "template_fallback" });
    }

    const artifacts = stamp(validated.data as GeneratedArtifacts, project);
    return NextResponse.json({ artifacts, source: "ai" });
  } catch (err) {
    console.error("AI generation failed, falling back to templates:", err);
    const artifacts = stamp(generateTemplateArtifacts(project), project);
    return NextResponse.json({ artifacts, source: "template_fallback" });
  }
}
