import { NextRequest, NextResponse } from "next/server";
import type { OnboardingProject } from "@/lib/types";
import { FutureStateAIWorkflowMapAIResponseSchema } from "@/lib/visualisations/workflow-types";
import {
  buildFutureStateAIWorkflowPrompt,
  WORKFLOW_PROMPT_VERSION,
} from "@/lib/visualisations/prompts";
import { buildFutureStateAIWorkflowTemplate } from "@/lib/visualisations/workflow-templates";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import {
  sanitizeFutureStateMap,
  salvageFutureStateMap,
} from "@/lib/visualisations/workflow-sanitize";
import { generateValidatedJson } from "@/lib/llm/generate-json";
import { MODELS } from "@/lib/llm/models";
import {
  guardApiRequest,
  parseBoundedJson,
  looksLikeProject,
} from "@/lib/api-guards";

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;

  const parsed = await parseBoundedJson<{
    project?: unknown;
    currentStateMapId?: string;
  }>(req);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const candidate = parsed.data?.project;
  if (!looksLikeProject(candidate)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  const project = candidate as OnboardingProject;
  const currentStateMapId =
    typeof parsed.data?.currentStateMapId === "string"
      ? parsed.data.currentStateMapId
      : undefined;

  const apiKey = process.env.OPENAI_API_KEY;
  const currentMap = project.visualisations?.currentStateWorkflowMap;

  if (!apiKey) {
    const map = buildFutureStateAIWorkflowTemplate(project, currentStateMapId);
    return NextResponse.json({
      map,
      source: "template",
      fallbackReason: "no_api_key",
    });
  }

  const { system, user } = buildFutureStateAIWorkflowPrompt(
    project,
    currentMap,
  );
  const result = await generateValidatedJson({
    apiKey,
    system,
    user,
    schema: FutureStateAIWorkflowMapAIResponseSchema,
    model: MODELS.chat,
    maxTokens: 5000,
  });

  let aiMap = result.ok ? result.data : null;
  let partial = false;
  if (!aiMap && !result.ok && result.error === "invalid_output") {
    aiMap = salvageFutureStateMap(result.raw);
    partial = aiMap !== null;
  }

  if (!aiMap) {
    const reason = result.ok ? "invalid_output" : result.error;
    console.error("Future-state map AI generation failed:", reason);
    const map = buildFutureStateAIWorkflowTemplate(project, currentStateMapId);
    return NextResponse.json({
      map,
      source: "template_fallback",
      fallbackReason: reason,
    });
  }

  // Clamp hallucinated references against the real current-state map before
  // the canvas tries to draw provenance links.
  const { map: sanitized, repairs } = sanitizeFutureStateMap(
    aiMap,
    project.id,
    currentMap ?? null,
  );
  if (repairs.length > 0) {
    console.warn("Future-state map sanitized:", repairs);
  }

  const map = {
    ...sanitized,
    source: "ai" as const,
    updatedAt: new Date().toISOString(),
    derivedFromHash: hashWorkflows(project.workflows),
    promptVersion: WORKFLOW_PROMPT_VERSION,
  };
  return NextResponse.json({
    map,
    source: "ai",
    ...(partial ? { partial: true } : {}),
    ...(result.ok && result.repaired ? { repaired: true } : {}),
  });
}
