import type { z } from "zod";
import { MODELS } from "./models";

// Shared "call OpenAI, get schema-valid JSON back" helper for generation
// routes. Centralises the failure handling the routes used to fumble
// individually: timeouts, truncation (finish_reason "length" used to surface
// as a JSON.parse crash), rate limits, and — most importantly — a single
// repair round-trip when the model's JSON doesn't match the schema, instead
// of silently discarding the response.

export type GenerateJsonErrorCode =
  | "timeout"
  | "rate_limited"
  | "upstream"
  | "truncated"
  | "empty"
  | "invalid_json"
  | "invalid_output";

export type GenerateJsonResult<T> =
  | { ok: true; data: T; repaired: boolean }
  | { ok: false; error: GenerateJsonErrorCode; raw?: unknown };

type Message = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_TIMEOUT_MS = 60_000;

type CallOutcome =
  | { ok: true; content: string }
  | { ok: false; error: GenerateJsonErrorCode };

async function callOnce(
  apiKey: string,
  model: string,
  messages: Message[],
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
): Promise<CallOutcome> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, error: isAbort ? "timeout" : "upstream" };
  }

  if (response.status === 429) return { ok: false, error: "rate_limited" };
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `generateValidatedJson upstream ${response.status}:`,
      detail.slice(0, 500),
    );
    return { ok: false, error: "upstream" };
  }

  const data = await response.json().catch(() => null);
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === "length") {
    // Truncated JSON used to blow up at JSON.parse and read as a generic
    // failure; surface it distinctly so callers can report it.
    return { ok: false, error: "truncated" };
  }
  const content = choice?.message?.content;
  if (!content) return { ok: false, error: "empty" };
  return { ok: true, content };
}

export async function generateValidatedJson<S extends z.ZodTypeAny>(opts: {
  apiKey: string;
  system: string;
  user: string;
  schema: S;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<GenerateJsonResult<z.infer<S>>> {
  const {
    apiKey,
    system,
    user,
    schema,
    model = MODELS.chat,
    temperature = 0.3,
    maxTokens = 4000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  const baseMessages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const first = await callOnce(
    apiKey,
    model,
    baseMessages,
    temperature,
    maxTokens,
    timeoutMs,
  );
  if (!first.ok) return { ok: false, error: first.error };

  let raw: unknown;
  try {
    raw = JSON.parse(first.content);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const validated = schema.safeParse(raw);
  if (validated.success) {
    return { ok: true, data: validated.data, repaired: false };
  }

  // One repair pass: show the model its own output and the first few schema
  // issues. This recovers the common near-miss failures (wrong enum value,
  // missing required key) that previously meant a silent template fallback.
  const issues = validated.error.issues
    .slice(0, 5)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");

  const repair = await callOnce(
    apiKey,
    model,
    [
      ...baseMessages,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: `Your JSON did not match the required schema. Problems:\n${issues}\n\nReturn the corrected JSON object only — same content, fixed structure. No commentary.`,
      },
    ],
    temperature,
    maxTokens,
    timeoutMs,
  );
  if (!repair.ok) return { ok: false, error: repair.error, raw };

  let repairedRaw: unknown;
  try {
    repairedRaw = JSON.parse(repair.content);
  } catch {
    return { ok: false, error: "invalid_output", raw };
  }

  const revalidated = schema.safeParse(repairedRaw);
  if (revalidated.success) {
    return { ok: true, data: revalidated.data, repaired: true };
  }
  console.error(
    "generateValidatedJson: repair pass still invalid:",
    revalidated.error.issues.slice(0, 3),
  );
  // Hand back the first (usually richer) raw output for salvage attempts.
  return { ok: false, error: "invalid_output", raw };
}
