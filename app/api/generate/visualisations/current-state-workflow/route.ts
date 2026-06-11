import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { OnboardingProject } from "@/lib/types";
import { CurrentStateWorkflowMapAIResponseSchema } from "@/lib/visualisations/workflow-types";
import { CURRENT_STATE_MAP_JSON_SCHEMA } from "@/lib/visualisations/workflow-json-schemas";
import {
  buildCurrentStateWorkflowPrompt,
  WORKFLOW_PROMPT_VERSION,
} from "@/lib/visualisations/prompts";
import { buildCurrentStateWorkflowTemplate } from "@/lib/visualisations/workflow-templates";
import { hashWorkflows } from "@/lib/visualisations/workflow-helpers";
import {
  sanitizeCurrentStateMap,
  salvageCurrentStateMap,
} from "@/lib/visualisations/workflow-sanitize";
import { generateValidatedJson } from "@/lib/llm/generate-json";
import { MODELS } from "@/lib/llm/models";
import {
  guardApiRequest,
  parseBoundedJson,
  looksLikeProject,
} from "@/lib/api-guards";

// KB context chunks ride along with the project (same pattern as
// generate/from-kb), so allow more than the default 256KB.
const VIZ_MAX_BODY_BYTES = 768 * 1024;

const ContextChunksSchema = z
  .array(
    z.object({
      id: z.string(),
      text: z.string().max(4000),
      label: z.string().max(200).optional(),
    }),
  )
  .max(8);

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;

  const parsed = await parseBoundedJson<{
    project?: unknown;
    contextChunks?: unknown;
  }>(req, VIZ_MAX_BODY_BYTES);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const candidate = parsed.data?.project;
  if (!looksLikeProject(candidate)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  const project = candidate as OnboardingProject;
  const chunksParsed = ContextChunksSchema.safeParse(
    parsed.data?.contextChunks ?? [],
  );
  const kbContext = chunksParsed.success ? chunksParsed.data : [];

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const map = buildCurrentStateWorkflowTemplate(project);
    return NextResponse.json({
      map,
      source: "template",
      fallbackReason: "no_api_key",
    });
  }

  const { system, user } = buildCurrentStateWorkflowPrompt(project, kbContext);
  const result = await generateValidatedJson({
    apiKey,
    system,
    user,
    schema: CurrentStateWorkflowMapAIResponseSchema,
    jsonSchema: {
      name: "current_state_workflow_map",
      schema: CURRENT_STATE_MAP_JSON_SCHEMA as unknown as Record<
        string,
        unknown
      >,
    },
    model: MODELS.chat,
    maxTokens: 4000,
  });

  // Validation failed even after the repair pass — keep whatever valid nodes
  // exist before resorting to the generic template.
  let aiMap = result.ok ? result.data : null;
  let partial = false;
  if (!aiMap && !result.ok && result.error === "invalid_output") {
    aiMap = salvageCurrentStateMap(result.raw);
    partial = aiMap !== null;
  }

  if (!aiMap) {
    const reason = result.ok ? "invalid_output" : result.error;
    console.error("Current-state map AI generation failed:", reason);
    const map = buildCurrentStateWorkflowTemplate(project);
    return NextResponse.json({
      map,
      source: "template_fallback",
      fallbackReason: reason,
    });
  }

  const { map: sanitized, repairs } = sanitizeCurrentStateMap(
    aiMap,
    project.id,
  );
  if (repairs.length > 0) {
    console.warn("Current-state map sanitized:", repairs);
  }

  // Stamp the server-owned fields. Trusting the AI to compute the hash or
  // timestamps would be silly — that's why they're not in the response schema.
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
