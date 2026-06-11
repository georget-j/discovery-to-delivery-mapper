import { describe, it, expect, beforeEach } from "vitest";
import {
  looksLikeProject,
  parseBoundedJson,
  MAX_BODY_BYTES,
  clientIp,
  consumeRateLimit,
  resetRateLimitBuckets,
  isSameOriginRequest,
  hasJsonContentType,
  guardApiRequest,
} from "../lib/api-guards";

// ── looksLikeProject ───────────────────────────────────────────────────────

describe("looksLikeProject", () => {
  it("accepts a minimal object with id + customer.companyName", () => {
    expect(
      looksLikeProject({ id: "abc", customer: { companyName: "Acme" } }),
    ).toBe(true);
  });

  it("rejects null / undefined / primitives", () => {
    expect(looksLikeProject(null)).toBe(false);
    expect(looksLikeProject(undefined)).toBe(false);
    expect(looksLikeProject("project")).toBe(false);
    expect(looksLikeProject(42)).toBe(false);
  });

  it("rejects missing id", () => {
    expect(looksLikeProject({ customer: { companyName: "Acme" } })).toBe(false);
  });

  it("rejects empty id", () => {
    expect(
      looksLikeProject({ id: "", customer: { companyName: "Acme" } }),
    ).toBe(false);
  });

  it("rejects non-string id", () => {
    expect(
      looksLikeProject({ id: 123, customer: { companyName: "Acme" } }),
    ).toBe(false);
  });

  it("rejects missing customer", () => {
    expect(looksLikeProject({ id: "abc" })).toBe(false);
  });

  it("rejects non-object customer", () => {
    expect(looksLikeProject({ id: "abc", customer: "Acme" })).toBe(false);
  });

  it("rejects missing customer.companyName", () => {
    expect(
      looksLikeProject({ id: "abc", customer: { industry: "fintech" } }),
    ).toBe(false);
  });
});

// ── parseBoundedJson ───────────────────────────────────────────────────────

function makeRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://x/y", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("parseBoundedJson", () => {
  it("parses a valid JSON body", async () => {
    const req = makeRequest(JSON.stringify({ ok: true }));
    // The helper takes a NextRequest, but it only uses headers + .text() — a
    // plain Request works in tests.
    const result = await parseBoundedJson(req as unknown as never);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ ok: true });
  });

  it("rejects invalid JSON", async () => {
    const req = makeRequest("{not json}");
    const result = await parseBoundedJson(req as unknown as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_json");
  });

  it("rejects empty body as invalid JSON", async () => {
    const req = makeRequest("");
    const result = await parseBoundedJson(req as unknown as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_json");
  });

  it("rejects payloads exceeding MAX_BODY_BYTES via content-length", async () => {
    const req = makeRequest("{}", {
      "content-length": String(MAX_BODY_BYTES + 1),
    });
    const result = await parseBoundedJson(req as unknown as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("too_large");
  });

  it("rejects payloads exceeding MAX_BODY_BYTES by actual size (no content-length)", async () => {
    const huge = "x".repeat(MAX_BODY_BYTES + 1);
    const req = new Request("http://x/y", { method: "POST", body: huge });
    const result = await parseBoundedJson(req as unknown as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("too_large");
  });

  it("accepts payloads at the boundary", async () => {
    // Build a JSON string just under the cap (a JSON-quoted string)
    const fill = MAX_BODY_BYTES - 20;
    const body = JSON.stringify({ pad: "x".repeat(fill) });
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_BYTES);
    const req = makeRequest(body);
    const result = await parseBoundedJson(req as unknown as never);
    expect(result.ok).toBe(true);
  });

  it("honours a custom maxBytes smaller than the default", async () => {
    const req = makeRequest(JSON.stringify({ pad: "x".repeat(100) }));
    const result = await parseBoundedJson(req as unknown as never, 50);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("too_large");
  });
});

// ── clientIp ───────────────────────────────────────────────────────────────

function makeGetRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/y", { method: "POST", headers, body: "{}" });
}

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    const req = makeGetRequest({
      "x-real-ip": "1.2.3.4",
      "x-forwarded-for": "5.6.7.8, 9.9.9.9",
    });
    expect(clientIp(req as unknown as never)).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const req = makeGetRequest({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" });
    expect(clientIp(req as unknown as never)).toBe("5.6.7.8");
  });

  it("returns 'unknown' when no headers are present", () => {
    const req = makeGetRequest();
    expect(clientIp(req as unknown as never)).toBe("unknown");
  });
});

// ── consumeRateLimit ───────────────────────────────────────────────────────

describe("consumeRateLimit", () => {
  beforeEach(() => resetRateLimitBuckets());

  it("allows up to the limit within a window, then denies", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(consumeRateLimit("k", { limit: 5, windowMs: 1000, now })).toBe(
        true,
      );
    }
    expect(consumeRateLimit("k", { limit: 5, windowMs: 1000, now })).toBe(
      false,
    );
  });

  it("refills tokens after the window elapses", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      consumeRateLimit("k", { limit: 5, windowMs: 1000, now });
    }
    expect(consumeRateLimit("k", { limit: 5, windowMs: 1000, now })).toBe(
      false,
    );
    expect(
      consumeRateLimit("k", { limit: 5, windowMs: 1000, now: now + 1000 }),
    ).toBe(true);
  });

  it("tracks keys independently", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      consumeRateLimit("a", { limit: 5, windowMs: 1000, now });
    }
    expect(consumeRateLimit("a", { limit: 5, windowMs: 1000, now })).toBe(
      false,
    );
    expect(consumeRateLimit("b", { limit: 5, windowMs: 1000, now })).toBe(true);
  });
});

// ── isSameOriginRequest ────────────────────────────────────────────────────

describe("isSameOriginRequest", () => {
  it("passes sec-fetch-site same-origin and none", () => {
    for (const v of ["same-origin", "none"]) {
      const req = makeGetRequest({ "sec-fetch-site": v });
      expect(isSameOriginRequest(req as unknown as never)).toBe(true);
    }
  });

  it("rejects sec-fetch-site cross-site and same-site", () => {
    for (const v of ["cross-site", "same-site"]) {
      const req = makeGetRequest({ "sec-fetch-site": v });
      expect(isSameOriginRequest(req as unknown as never)).toBe(false);
    }
  });

  it("compares Origin against the request origin when sec-fetch-site is absent", () => {
    const same = makeGetRequest({ origin: "http://x" });
    expect(isSameOriginRequest(same as unknown as never)).toBe(true);
    const cross = makeGetRequest({ origin: "https://evil.example" });
    expect(isSameOriginRequest(cross as unknown as never)).toBe(false);
  });

  it("passes requests with neither header (curl)", () => {
    const req = makeGetRequest();
    expect(isSameOriginRequest(req as unknown as never)).toBe(true);
  });
});

// ── guardApiRequest ────────────────────────────────────────────────────────

describe("guardApiRequest", () => {
  beforeEach(() => resetRateLimitBuckets());

  it("returns null for a same-origin JSON request", () => {
    const req = makeGetRequest({
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
    });
    expect(guardApiRequest(req as unknown as never)).toBeNull();
  });

  it("returns 403 for cross-site requests", () => {
    const req = makeGetRequest({
      "sec-fetch-site": "cross-site",
      "content-type": "application/json",
    });
    const res = guardApiRequest(req as unknown as never);
    expect(res?.status).toBe(403);
  });

  it("returns 415 for non-JSON content types on JSON routes", () => {
    const req = makeGetRequest({
      "sec-fetch-site": "same-origin",
      "content-type": "text/plain",
    });
    const res = guardApiRequest(req as unknown as never);
    expect(res?.status).toBe(415);
  });

  it("skips the content-type check when json: false", () => {
    const req = makeGetRequest({
      "sec-fetch-site": "same-origin",
      "content-type": "multipart/form-data; boundary=x",
    });
    expect(
      guardApiRequest(req as unknown as never, { json: false }),
    ).toBeNull();
  });

  it("returns 429 after the per-route limit is exhausted", () => {
    const headers = {
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      "x-real-ip": "9.9.9.9",
    };
    let last: ReturnType<typeof guardApiRequest> = null;
    for (let i = 0; i < 31; i++) {
      last = guardApiRequest(makeGetRequest(headers) as unknown as never);
    }
    expect(last?.status).toBe(429);
  });

  it("accepts charset-suffixed JSON content types", () => {
    const req = makeGetRequest({
      "sec-fetch-site": "same-origin",
      "content-type": "application/json; charset=utf-8",
    });
    expect(hasJsonContentType(req as unknown as never)).toBe(true);
  });
});
