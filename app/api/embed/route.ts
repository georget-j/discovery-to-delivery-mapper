import { NextRequest, NextResponse } from "next/server";
import { EmbedRequestSchema } from "@/lib/schemas";

// Server-side proxy for OpenAI's text-embedding-3-small. The client batches
// calls (see lib/kb/embed-client.ts) and this endpoint enforces a per-call
// ceiling so a runaway client can't blow our token budget in a single request.
//
// Notes:
//   - We accept up to 100 inputs per call and a generous body cap (4 MB) to
//     fit 100 × ~40 KB chunks. The 256 KB project-body cap doesn't apply here.
//   - On 429 / 5xx we retry up to 3 times with exponential backoff before
//     surfacing a typed error to the client.

const EMBED_MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const MAX_RETRIES = 3;

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens?: number };
};

export async function POST(req: NextRequest) {
  // Bounded body parse — same pattern as parseBoundedJson but with a larger cap.
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > EMBED_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > EMBED_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validated = EmbedRequestSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: "invalid_input",
        message: validated.error.issues[0]?.message ?? "validation error",
      },
      { status: 400 },
    );
  }
  const { texts } = validated.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" });
  }

  let attempt = 0;
  let lastError: { status: number; message: string } | null = null;
  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBED_MODEL,
          input: texts,
          dimensions: EMBED_DIMS,
        }),
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs =
          retryAfter && /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000
            : backoffDelay(attempt);
        lastError = {
          status: response.status,
          message: `OpenAI ${response.status}`,
        };
        await sleep(delayMs);
        attempt++;
        continue;
      }

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        return NextResponse.json(
          {
            error: "upstream",
            message: message.slice(0, 500) || `status ${response.status}`,
          },
          { status: 502 },
        );
      }

      const data = (await response.json()) as OpenAIEmbeddingResponse;
      const sorted = (data.data ?? [])
        .slice()
        .sort((a, b) => a.index - b.index);
      const embeddings = sorted.map((d) => d.embedding);

      if (embeddings.length !== texts.length) {
        return NextResponse.json(
          {
            error: "upstream",
            message: `Embedding count mismatch (got ${embeddings.length}, expected ${texts.length})`,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        embeddings,
        tokensUsed: data.usage?.total_tokens ?? 0,
      });
    } catch (err) {
      lastError = {
        status: 0,
        message: err instanceof Error ? err.message : "network error",
      };
      await sleep(backoffDelay(attempt));
      attempt++;
    }
  }

  return NextResponse.json(
    {
      error: lastError?.status === 429 ? "rate_limited" : "upstream",
      message: lastError?.message ?? "exhausted retries",
    },
    { status: lastError?.status === 429 ? 429 : 502 },
  );
}

function backoffDelay(attempt: number): number {
  // 1s, 2s, 4s with a tiny jitter so concurrent clients don't all retry in lockstep.
  const base = 1000 * 2 ** attempt;
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
