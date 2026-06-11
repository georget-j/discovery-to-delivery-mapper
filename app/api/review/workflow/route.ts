import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import { WorkflowReviewResponseSchema } from "@/lib/schemas";
import { guardApiRequest } from "@/lib/api-guards";
import type { FutureStateAIWorkflowMap } from "@/lib/visualisations/workflow-types";

// Semantic "review & tidy" pass. Deterministic rules (lib/visualisations/
// workflow-review.ts) catch orphans + near-identical titles; this endpoint
// catches the fuzzy cases they miss — two agents that "do the same job" under
// different names, or a node that doesn't belong in this workflow. Returns
// findings the client merges with the rule findings; the user confirms each
// before anything changes.

export const REVIEW_PROMPT_VERSION = "1";

const REVIEW_MAX_BODY_BYTES = 1.5 * 1024 * 1024;

const SYSTEM_PROMPT = `You are reviewing a customer's future-state AI workflow MAP (a node-and-edge graph) for clutter and mistakes.

You will be given the map's nodes (id, type, title, description) and edges (source → target).

Flag ONLY high-confidence problems:
- "duplicate": two or more nodes that do essentially the SAME job, even if named differently (e.g. an "Alert triage bot" and an "AML disposition agent" that both classify the same alerts). List all involved node ids.
- "misplaced": a node that doesn't belong in this workflow / is off-topic for the customer's process.
- "redundant": an extra layer that duplicates another (e.g. two separate monitoring layers).

Do NOT flag nodes that are legitimately different stages, parallel branches, or intentional validators/guardrails. When unsure, leave it out.

For each finding set suggestedAction:
- "merge" for duplicate/redundant (collapse into one)
- "remove" for a misplaced node that should be deleted
- "keep" if you're flagging for awareness but recommend keeping

OUTPUT JSON SHAPE
{
  "findings": [
    { "kind": "duplicate", "nodeIds": ["id1","id2"], "reason": "one sentence", "suggestedAction": "merge" }
  ]
}

Quality bar: precision over recall. An empty findings array is the right answer for a clean map.`;

type SlimNode = {
  id: string;
  type: string;
  title: string;
  description?: string;
};

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > REVIEW_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > REVIEW_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let parsed: { map?: FutureStateAIWorkflowMap };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { map } = parsed;
  if (
    !map ||
    !Array.isArray(map.nodes) ||
    !Array.isArray(map.edges) ||
    map.nodes.length < 2
  ) {
    // Nothing to compare — empty findings, not an error.
    return NextResponse.json({ findings: [] });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "no_api_key", findings: [] },
      { status: 503 },
    );
  }

  const nodes: SlimNode[] = map.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    description: n.description,
  }));
  const edges = map.edges.map((e) => ({ source: e.source, target: e.target }));

  const userPrompt = `NODES:\n${JSON.stringify(nodes, null, 2)}\n\nEDGES:\n${JSON.stringify(edges)}\n\nReturn findings for genuine duplicates / misplaced / redundant nodes only.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.cheap,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        ...completionParams(MODELS.cheap, { temperature: 0.2, maxTokens: 1500 }),
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const validated = WorkflowReviewResponseSchema.safeParse(
      JSON.parse(content),
    );
    if (!validated.success) {
      console.error("review schema validation failed:", validated.error);
      return NextResponse.json(
        { error: "generation_failed", findings: [] },
        { status: 502 },
      );
    }

    // Clamp nodeIds to ids that actually exist; drop findings left empty.
    const ids = new Set(map.nodes.map((n) => n.id));
    const findings = validated.data.findings
      .map((f) => ({ ...f, nodeIds: f.nodeIds.filter((id) => ids.has(id)) }))
      .filter((f) => f.nodeIds.length >= (f.kind === "misplaced" ? 1 : 2));

    return NextResponse.json({ findings });
  } catch (err) {
    // Upstream error text stays in the server log; clients get a generic body.
    console.error("Workflow review failed:", err);
    return NextResponse.json(
      {
        error: "generation_failed",
        findings: [],
        message: "Workflow review failed",
      },
      { status: 502 },
    );
  }
}
