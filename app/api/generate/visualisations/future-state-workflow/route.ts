import { NextRequest, NextResponse } from "next/server";
import type { OnboardingProject } from "@/lib/types";
import { FutureStateAIWorkflowMapSchema } from "@/lib/visualisations/workflow-types";
import { buildFutureStateAIWorkflowPrompt } from "@/lib/visualisations/prompts";
import { buildFutureStateAIWorkflowTemplate } from "@/lib/visualisations/workflow-templates";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import { parseBoundedJson, looksLikeProject } from "@/lib/api-guards";

export async function POST(req: NextRequest) {
  const parsed = await parseBoundedJson<{ project?: unknown; currentStateMapId?: string }>(req);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const candidate = parsed.data?.project;
  if (!looksLikeProject(candidate)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  const project = candidate as OnboardingProject;
  const currentStateMapId = typeof parsed.data?.currentStateMapId === "string" ? parsed.data.currentStateMapId : undefined;

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

    const map = { ...validated.data, derivedFromHash: hashWorkflows(project.workflows) };
    return NextResponse.json({ map, source: "ai" });
  } catch (err) {
    console.error("Future-state map AI generation failed:", err);
    const map = buildFutureStateAIWorkflowTemplate(project, currentStateMapId);
    return NextResponse.json({ map, source: "template_fallback" });
  }
}
