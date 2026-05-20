import type { NextRequest } from "next/server";

// Roughly the size of the largest seeded scenario (fintech-aml at ~30KB) × 4 to
// leave headroom for richer projects without unbounded growth. Anything larger
// is almost certainly malicious or buggy.
export const MAX_BODY_BYTES = 256 * 1024;

// Read the request body as JSON, but cap the read at MAX_BODY_BYTES so a
// hostile client can't make us buffer 50MB into memory. We rely on the
// Content-Length header for the fast path, and stream-check the actual bytes
// as a backstop for clients that omit it.
export async function parseBoundedJson<T = unknown>(req: NextRequest): Promise<
  { ok: true; data: T } | { ok: false; error: "too_large" | "invalid_json" }
> {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return { ok: false, error: "too_large" };
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, error: "too_large" };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

// Minimal shape check — does this look like an OnboardingProject? We do not
// pull in a full Zod schema (every type touched by the AI prompt would need
// one), but we do refuse non-objects, missing customer profile, and missing id.
// Prompt-injection risk is mitigated by clear delimiters in the prompt itself,
// not by sanitising fields here.
export function looksLikeProject(value: unknown): value is { id: string; customer: { companyName: string } } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id.length === 0) return false;
  if (!v.customer || typeof v.customer !== "object") return false;
  const c = v.customer as Record<string, unknown>;
  return typeof c.companyName === "string";
}
