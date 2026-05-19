import { NextRequest, NextResponse } from "next/server";
import type { OnboardingProject, GeneratedArtifacts } from "@/lib/types";
import { buildArtifactPrompt } from "@/lib/prompts";
import { GeneratedArtifactsSchema } from "@/lib/schemas";
import { generateTemplateArtifacts } from "@/lib/artifact-templates";
import { hashGenerationInputs } from "@/lib/artifact-helpers";

// Stamp every generated GeneratedArtifacts blob with the input hash + timestamp
// so the Outputs page can detect when project inputs have drifted since.
function stamp(artifacts: GeneratedArtifacts, project: OnboardingProject): GeneratedArtifacts {
  return {
    ...artifacts,
    derivedFromHash: hashGenerationInputs(project),
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  let project: OnboardingProject;
  try {
    project = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // No API key — return deterministic template artifacts
    const artifacts = stamp(generateTemplateArtifacts(project), project);
    return NextResponse.json({ artifacts, source: "template" });
  }

  try {
    const { system, user } = buildArtifactPrompt(project);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 8000,
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
