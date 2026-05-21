import { NextRequest, NextResponse } from "next/server";
import { parseBoundedJson, looksLikeProject } from "@/lib/api-guards";
import { projectContextBundle } from "@/lib/copilot-context";
import { industryVoice } from "@/lib/industry-personae";
import type { OnboardingProject } from "@/lib/types";

const SYSTEM_PROMPT = `You are a forward-deployed AI deployment assistant for a discovery-to-delivery mapping tool.

You have full read access to the user's onboarding project state — provided as a compact context bundle below. Answer the user's question grounded in that state.

GROUND RULES
- Cite source entities by their bracketed ID when you reference them. Use the form [id] (e.g. [w-123]) — UIs render these as clickable chips.
- If the user asks about something not in the context, say so plainly. Do not invent stakeholders, systems, or data.
- Keep answers concise. Long-form is fine only when the user explicitly asks for detail.
- Suggest the user's next concrete action where it helps.
- Never claim to "have updated" the project — you are read-only.

TONE
- Direct, practical, no fluff.
- No marketing language ("synergies", "leverage", "robust solution").
- Match the voice of a forward-deployed engineer talking to another engineer.`;

type Turn = { role: "user" | "assistant"; content: string };

type Payload = {
  project?: unknown;
  message?: unknown;
  history?: unknown;
};

export async function POST(req: NextRequest) {
  const parsed = await parseBoundedJson<Payload>(req);
  if (!parsed.ok) {
    const status = parsed.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const { project: projectRaw, message, history } = parsed.data ?? {};
  if (!looksLikeProject(projectRaw)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "message_too_long" }, { status: 413 });
  }

  const project = projectRaw as OnboardingProject;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" });
  }

  const turns: Turn[] = Array.isArray(history)
    ? (history as Turn[]).filter(
        (t) =>
          t &&
          (t.role === "user" || t.role === "assistant") &&
          typeof t.content === "string",
      )
    : [];
  // Cap history to last 10 turns to keep tokens bounded
  const bounded = turns.slice(-10);

  const voice = industryVoice(project.customer.industry);
  const context = projectContextBundle(project);
  const system = [
    SYSTEM_PROMPT,
    voice && `\nINDUSTRY VOICE (apply to your reply):\n${voice}`,
    `\n## Project context\n${context}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
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
          ...bounded.map((t) => ({ role: t.role, content: t.content })),
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `OpenAI API error: ${response.status} — ${detail.slice(0, 200)}`,
      );
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    return NextResponse.json({ reply: content.trim() });
  } catch (err) {
    console.error("Copilot turn failed:", err);
    return NextResponse.json({
      error: "copilot_failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
