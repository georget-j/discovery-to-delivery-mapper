import { NextRequest, NextResponse } from "next/server";
import type { OnboardingProject } from "@/lib/types";
import { CurrentStateWorkflowMapSchema } from "@/lib/visualisations/workflow-types";
import { buildCurrentStateWorkflowPrompt } from "@/lib/visualisations/prompts";
import { buildCurrentStateWorkflowTemplate } from "@/lib/visualisations/workflow-templates";

export async function POST(req: NextRequest) {
  let project: OnboardingProject;
  try {
    const body = await req.json();
    project = body.project;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!project?.id) {
    return NextResponse.json({ error: "missing_project" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const map = buildCurrentStateWorkflowTemplate(project);
    return NextResponse.json({ map, source: "template" });
  }

  try {
    const { system, user } = buildCurrentStateWorkflowPrompt(project);
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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty response");

    const parsed = JSON.parse(content);
    const validated = CurrentStateWorkflowMapSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("Current-state map AI validation failed:", validated.error);
      const map = buildCurrentStateWorkflowTemplate(project);
      return NextResponse.json({ map, source: "template_fallback" });
    }

    return NextResponse.json({ map: validated.data, source: "ai" });
  } catch (err) {
    console.error("Current-state map AI generation failed:", err);
    const map = buildCurrentStateWorkflowTemplate(project);
    return NextResponse.json({ map, source: "template_fallback" });
  }
}
