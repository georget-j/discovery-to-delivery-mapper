import { NextRequest, NextResponse } from "next/server";
import { MODELS, completionParams } from "@/lib/llm/models";
import { guardApiRequest } from "@/lib/api-guards";

// Per-doc summary endpoint. Caller posts the first N chunks of a doc and
// gets back a short paragraph summary. The caller persists the summary back
// onto KnowledgeBaseDoc.summary; we don't touch project state here.

const SUM_MAX_BODY_BYTES = 256 * 1024;

const SYSTEM_PROMPT = `You summarise a document for a forward-deployed onboarding workspace.
Output: ONE paragraph, ≤ 90 words. Lead with the document's purpose; then 2-3 specific facts
(systems mentioned, teams, processes, deadlines). Plain prose — no markdown, no headers.`;

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req);
  if (blocked) return blocked;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > SUM_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > SUM_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let parsed: { docName?: string; chunks?: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { docName = "document", chunks = [] } = parsed;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return NextResponse.json({ error: "no_chunks" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  // The excerpt is capped at 12000 chars; the name needs its own cap or it
  // becomes an uncapped prompt-size vector.
  const safeDocName = String(docName).slice(0, 200);
  const userPrompt = `Document name: ${safeDocName}\n\nExcerpt:\n${chunks.slice(0, 8).join("\n---\n").slice(0, 12000)}`;

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
        ...completionParams(MODELS.cheap, { temperature: 0.2, maxTokens: 300 }),
      }),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const data = await response.json();
    const summary = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!summary) throw new Error("Empty summary");
    return NextResponse.json({ summary });
  } catch (err) {
    // Upstream error text stays in the server log; clients get a generic body.
    console.error("Doc summary failed:", err);
    return NextResponse.json(
      {
        error: "summary_failed",
        message: "Summary generation failed",
      },
      { status: 502 },
    );
  }
}
