import { NextRequest, NextResponse } from "next/server";
import { MODELS } from "@/lib/llm/models";
import { z } from "zod";
import { NotesExtractionResultSchema } from "@/lib/schemas";
import {
  guardApiRequest,
  parseBoundedJson,
  looksLikeProject,
} from "@/lib/api-guards";
import {
  INTERVIEW_SYSTEM_PROMPT,
  serializeInterviewContext,
} from "@/lib/prompts/discovery-interview";
import type { OnboardingProject } from "@/lib/types";

// Conversational discovery endpoint — one user turn in, one reply +
// extracted patch + next question out. The client auto-applies the
// extracted patch to project state (no diff panel; the chat IS the diff).

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatResponseSchema = z.object({
  reply: z.string().min(1),
  extracted: NotesExtractionResultSchema.optional(),
  nextQuestion: z.string().nullable().optional(),
});

const MAX_HISTORY = 20;

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;

  const parsed = await parseBoundedJson<{
    project?: OnboardingProject;
    history?: unknown;
  }>(req);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const { project, history } = parsed.data ?? {};
  if (!looksLikeProject(project)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  const historyParsed = z.array(MessageSchema).safeParse(history);
  if (!historyParsed.success) {
    return NextResponse.json({ error: "invalid_history" }, { status: 400 });
  }
  const trimmed = historyParsed.data.slice(-MAX_HISTORY);
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "empty_history" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const systemMessage = `${INTERVIEW_SYSTEM_PROMPT}\n\nPROJECT STATE SO FAR:\n${serializeInterviewContext(project)}`;

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
          { role: "system", content: systemMessage },
          ...trimmed.map((m) => ({ role: m.role, content: m.content })),
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const parsedJson = JSON.parse(content);
    const validated = ChatResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("Chat schema validation failed:", validated.error);
      return NextResponse.json(
        {
          error: "chat_failed",
          message: `Response did not match schema: ${validated.error.issues[0]?.message ?? "validation error"}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(validated.data);
  } catch (err) {
    // err.message can carry upstream/model fragments — keep it server-side.
    console.error("Discovery chat failed:", err);
    return NextResponse.json(
      { error: "chat_failed", message: "Chat request failed" },
      { status: 502 },
    );
  }
}
