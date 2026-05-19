import { NextRequest, NextResponse } from "next/server";
import type { OnboardingProject } from "@/lib/types";
import { FutureStateAIWorkflowMapSchema } from "@/lib/visualisations/workflow-types";
import { buildFutureStateAIWorkflowPrompt } from "@/lib/visualisations/prompts";
import { buildFutureStateAIWorkflowTemplate } from "@/lib/visualisations/workflow-templates";

export async function POST(req: NextRequest) {
  let project: OnboardingProject;
  let currentStateMapId: string | undefined;
  try {
    const body = await req.json();
    project = body.project;
    currentStateMapId = body.currentStateMapId;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!project?.id) {
    return NextResponse.json({ error: "missing_project" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const currentMap = project.visualisations?.currentStateWorkflowMap;

  if (!apiKey) {
    const map = buildFutureStateAIWorkflowTemplate(project, currentStateMapId);
    return NextResponse.json({ map, source: "template" });
  }

  try {
    const { system, user } = buildFutureStateAIWorkflowPrompt(project, currentMap);
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
        max_tokens: 5000,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty response");

    const parsed = JSON.parse(content);
    const validated = FutureStateAIWorkflowMapSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("Future-state map AI validation failed:", validated.error);
      const map = buildFutureStateAIWorkflowTemplate(project, currentStateMapId);
      return NextResponse.json({ map, source: "template_fallback" });
    }

    return NextResponse.json({ map: validated.data, source: "ai" });
  } catch (err) {
    console.error("Future-state map AI generation failed:", err);
    const map = buildFutureStateAIWorkflowTemplate(project, currentStateMapId);
    return NextResponse.json({ map, source: "template_fallback" });
  }
}
