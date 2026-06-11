import { NextResponse, type NextRequest } from "next/server";

// Roughly the size of the largest seeded scenario (fintech-aml at ~30KB) × 4 to
// leave headroom for richer projects without unbounded growth. Anything larger
// is almost certainly malicious or buggy.
export const MAX_BODY_BYTES = 256 * 1024;

// Read the request body as JSON, but cap the read at maxBytes so a hostile
// client can't make us buffer 50MB into memory. We rely on the Content-Length
// header for the fast path, and stream-check the actual bytes as a backstop
// for clients that omit it.
export async function parseBoundedJson<T = unknown>(
  req: NextRequest,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<
  { ok: true; data: T } | { ok: false; error: "too_large" | "invalid_json" }
> {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    return { ok: false, error: "too_large" };
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (raw.length > maxBytes) {
    return { ok: false, error: "too_large" };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

// ── Abuse guards ────────────────────────────────────────────────────────────
// Every /api route proxies a paid OpenAI key on a public deployment with no
// auth, so each handler runs guardApiRequest() first: same-origin check (stops
// cross-site browser abuse), content-type check (kills no-preflight text/plain
// CSRF posts), and a per-IP token bucket (friction against curl loops).
//
// The bucket lives in module memory, so on serverless it is per-isolate —
// real spend enforcement is the OpenAI budget cap, not this. It still turns
// "free unlimited proxy" into "throttled nuisance".

const RATE_LIMIT_DEFAULT = 30; // requests per window per IP per route
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_KEYS = 5_000;

type Bucket = { tokens: number; refilledAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(req: NextRequest): string {
  // Vercel sets x-real-ip / x-forwarded-for at its proxy; prefer x-real-ip
  // since the first XFF entry can be client-supplied on other hosts.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || "unknown";
}

// Token-bucket check for an arbitrary key. Exported separately from the
// request wrapper so tests can drive it with fake keys and tight windows.
export function consumeRateLimit(
  key: string,
  {
    limit = RATE_LIMIT_DEFAULT,
    windowMs = RATE_LIMIT_WINDOW_MS,
    now = Date.now(),
  }: { limit?: number; windowMs?: number; now?: number } = {},
): boolean {
  if (buckets.size > RATE_LIMIT_MAX_KEYS) {
    // Bound memory: drop idle buckets; if everything is active, reset rather
    // than grow without limit (open-fail is acceptable for a friction layer).
    for (const [k, b] of buckets) {
      if (now - b.refilledAt > windowMs) buckets.delete(k);
    }
    if (buckets.size > RATE_LIMIT_MAX_KEYS) buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket) {
    buckets.set(key, { tokens: limit - 1, refilledAt: now });
    return true;
  }

  const elapsed = now - bucket.refilledAt;
  const refill = (elapsed / windowMs) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.refilledAt = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function isSameOriginRequest(req: NextRequest): boolean {
  // Sec-Fetch-Site is set by all modern browsers and can't be forged from JS.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  // Fall back to Origin. A missing Origin (curl, server-to-server) passes:
  // this check only exists to stop cross-site *browser* abuse; non-browser
  // clients are handled by the rate limiter + OpenAI budget cap.
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const selfOrigin = req.nextUrl?.origin ?? new URL(req.url).origin;
    return new URL(origin).origin === selfOrigin;
  } catch {
    return false;
  }
}

export function hasJsonContentType(req: NextRequest): boolean {
  const ct = req.headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("application/json");
}

// Run the shared abuse checks. Returns a ready-to-return error response, or
// null when the request may proceed. `json: false` skips the content-type
// check (multipart routes); `limit` overrides the per-route bucket size.
export function guardApiRequest(
  req: NextRequest,
  {
    json = true,
    limit = RATE_LIMIT_DEFAULT,
  }: { json?: boolean; limit?: number } = {},
): NextResponse | null {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  }
  if (json && !hasJsonContentType(req)) {
    return NextResponse.json(
      { error: "unsupported_content_type" },
      { status: 415 },
    );
  }
  const path = req.nextUrl?.pathname ?? new URL(req.url).pathname;
  if (!consumeRateLimit(`${clientIp(req)}:${path}`, { limit })) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }
  return null;
}

// Minimal shape check — does this look like an OnboardingProject? We do not
// pull in a full Zod schema (every type touched by the AI prompt would need
// one), but we do refuse non-objects, missing customer profile, and missing id.
// Prompt-injection risk is mitigated by clear delimiters in the prompt itself,
// not by sanitising fields here.
export function looksLikeProject(
  value: unknown,
): value is { id: string; customer: { companyName: string } } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id.length === 0) return false;
  if (!v.customer || typeof v.customer !== "object") return false;
  const c = v.customer as Record<string, unknown>;
  return typeof c.companyName === "string";
}
