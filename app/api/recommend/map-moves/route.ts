import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import { MapMovesResponseSchema } from "@/lib/schemas";
import { guardApiRequest } from "@/lib/api-guards";
import { serializePatternsForPrompt } from "@/lib/patterns/future-state-patterns";
import type { OnboardingProject } from "@/lib/types";
import type { FutureStateAIWorkflowMap } from "@/lib/visualisations/workflow-types";

// Map-aware future-state recommendations. Unlike /api/recommend/future-state
// (which reasons over project.workflows and returns step-keyed advice that the
// canvas can't place), this endpoint reasons over the ACTUAL future-state map
// graph and returns "moves" that each name an existing map node to anchor to
// plus the nodes/edges to insert. The server then clamps every node reference
// to IDs that actually exist, so applied AI ideas always land wired into the
// workflow rather than floating.

export const MAP_MOVES_PROMPT_VERSION = "1";

const MAP_MOVES_MAX_BODY_BYTES = 1.5 * 1024 * 1024;

const SYSTEM_PROMPT = `You are an expert AI deployment strategist improving a customer's future-state AI workflow MAP (a node-and-edge graph).

You will be given:
- The customer profile + Discovery context
- The current MAP: a list of nodes (each with an id, type, lane, title) and their downstream node ids
- Optionally a FOCUS_NODE_ID: the stage the user is currently looking at — prioritise moves anchored there

Your job: propose concrete "moves" that improve the workflow by inserting nodes wired INTO the existing graph. Anchor every move to an existing node and show how data flows between stages with edge labels.

NODE TYPES (use verbatim): human_action, ai_assist, ai_agent, system_action, data_retrieval, guardrail, decision_gate, approval, monitoring, audit_log, exception_path
LANES (use verbatim): lane_human, lane_ai, lane_systems, lane_guardrails, lane_compliance, lane_monitoring

PATTERN CATALOGUE (set patternFamily to one of the families below)
---------
${serializePatternsForPrompt()}
---------

RULES
- sourceNodeId MUST be the id of an existing node from the supplied MAP (never invent an id). This is the stage the new nodes attach to. Use null ONLY for a standalone monitoring/guardrail layer with no single anchor.
- insert.nodes: 1–4 new nodes. Each has a local "key" (e.g. "a", "v"), a type, a laneId, a title, and a short description. Agents go in lane_ai; validators/guardrails in lane_guardrails; approvals in lane_compliance; monitoring/audit in lane_monitoring; retrieval/system calls in lane_systems.
- insert.connectFromSource: true to wire sourceNodeId → the first inserted node. insert.connectFromSourceLabel: the data passed (e.g. "alerts", "draft output").
- insert.internalEdges: edges between inserted nodes by key, each with a short data label (e.g. {"from":"a","to":"v","label":"draft output"}).
- insert.connectToExisting: wire an inserted node (by key) back into an existing downstream node id, with a label — use this so the new agent passes its result onward into the real flow (e.g. the validated output continues to the next stage). Only reference ids present in the MAP.
- patternFamily: one of agent, agent_with_validator, multi_agent, rag, rules_plus_ai, hitl, continuous_learning, copilot.
- title: short imperative ("Add a validator agent to verify dispositions"). rationale: 1–2 sentences grounded in THIS stage.
- id: short unique slug ("m1", "m2", …).
- stageQuestions: a map from existing node id → 1–2 short clarifying questions you'd ask about that stage to refine the design (volume, judgment vs routine, reversibility, etc.).

OUTPUT JSON SHAPE
{
  "moves": [
    {
      "id": "m1",
      "sourceNodeId": "<existing node id or null>",
      "patternFamily": "agent_with_validator",
      "title": "string",
      "rationale": "string",
      "insert": {
        "nodes": [{ "key": "v", "type": "guardrail", "laneId": "lane_guardrails", "title": "Validator agent", "description": "string" }],
        "connectFromSource": true,
        "connectFromSourceLabel": "draft output",
        "internalEdges": [],
        "connectToExisting": [{ "fromKey": "v", "toNodeId": "<existing downstream id>", "label": "verified" }]
      }
    }
  ],
  "stageQuestions": { "<node id>": ["question?"] }
}

Quality bar: prefer 3–6 high-signal, well-anchored moves over many generic ones. Empty moves array is acceptable if the map is already production-ready.`;

type SlimNode = {
  id: string;
  type: string;
  title: string;
  laneId: string;
  downstreamIds: string[];
};

function slimMap(map: FutureStateAIWorkflowMap): {
  nodes: SlimNode[];
  expectedBenefits: string[];
  assumptions: string[];
} {
  const downstream = new Map<string, string[]>();
  for (const e of map.edges) {
    const list = downstream.get(e.source) ?? [];
    list.push(e.target);
    downstream.set(e.source, list);
  }
  return {
    nodes: map.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      laneId: n.laneId,
      downstreamIds: downstream.get(n.id) ?? [],
    })),
    expectedBenefits: map.expectedBenefits ?? [],
    assumptions: map.assumptions ?? [],
  };
}

function serializeCustomer(project: OnboardingProject): string {
  const c = project.customer;
  const d = project.discovery;
  return JSON.stringify(
    {
      companyName: c.companyName,
      industry: c.industry,
      primaryUseCase: c.primaryUseCase,
      businessProblem: c.businessProblem,
      regulatoryContext: c.regulatoryContext,
      technicalMaturity: c.technicalMaturity,
      currentProcess: d.currentProcess,
      successDefinition: d.successDefinition,
    },
    null,
    2,
  );
}

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAP_MOVES_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > MAP_MOVES_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let parsed: {
    project?: OnboardingProject;
    map?: FutureStateAIWorkflowMap;
    focusNodeId?: string | null;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { project, map, focusNodeId } = parsed;
  if (!project || !map || !Array.isArray(map.nodes) || map.nodes.length < 1) {
    return NextResponse.json(
      { error: "invalid_input", message: "Need a project with a map" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "no_api_key", moves: [] },
      { status: 503 },
    );
  }

  const slim = slimMap(map);
  const focus =
    focusNodeId && map.nodes.some((n) => n.id === focusNodeId)
      ? focusNodeId
      : null;

  const userPrompt = [
    `CUSTOMER:\n${serializeCustomer(project)}`,
    `\nMAP (${slim.nodes.length} nodes):\n${JSON.stringify(slim, null, 2)}`,
    focus ? `\nFOCUS_NODE_ID: ${focus}` : "",
    `\nPropose map-improving moves anchored to existing node ids. Wire new agents in with labeled data-flow edges.`,
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
        ...completionParams(MODELS.chat, { temperature: 0.4, maxTokens: 3000 }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const validated = MapMovesResponseSchema.safeParse(JSON.parse(content));
    if (!validated.success) {
      console.error("map-moves schema validation failed:", validated.error);
      return NextResponse.json(
        {
          error: "generation_failed",
          moves: [],
          message: `Response did not match schema: ${validated.error.issues[0]?.message ?? "validation error"}`,
        },
        { status: 502 },
      );
    }

    // Connection guarantee: clamp every node reference to ids that actually
    // exist in the submitted map. A move that anchors to a non-existent node
    // gets sourceNodeId nulled; invalid back-connections are dropped. This is
    // what makes "it connects" structural rather than best-effort.
    const ids = new Set(map.nodes.map((n) => n.id));
    const moves = validated.data.moves.map((m) => {
      const sourceNodeId =
        m.sourceNodeId && ids.has(m.sourceNodeId) ? m.sourceNodeId : null;
      const connectToExisting = (m.insert.connectToExisting ?? []).filter((c) =>
        ids.has(c.toNodeId),
      );
      return {
        ...m,
        sourceNodeId,
        insert: {
          ...m.insert,
          // Force a source connection whenever we have a valid anchor.
          connectFromSource: sourceNodeId
            ? (m.insert.connectFromSource ?? true)
            : false,
          connectToExisting,
        },
      };
    });

    return NextResponse.json({
      moves,
      stageQuestions: validated.data.stageQuestions ?? {},
    });
  } catch (err) {
    // err.message can carry upstream/model fragments — keep it server-side.
    console.error("Map-moves recommendation failed:", err);
    return NextResponse.json(
      { error: "generation_failed", moves: [], message: "Generation failed" },
      { status: 502 },
    );
  }
}
