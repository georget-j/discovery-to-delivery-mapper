import { describe, it, expect } from "vitest";
import { looksLikeProject, parseBoundedJson, MAX_BODY_BYTES } from "../lib/api-guards";

// ── looksLikeProject ───────────────────────────────────────────────────────

describe("looksLikeProject", () => {
  it("accepts a minimal object with id + customer.companyName", () => {
    expect(looksLikeProject({ id: "abc", customer: { companyName: "Acme" } })).toBe(true);
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
    expect(looksLikeProject({ id: "", customer: { companyName: "Acme" } })).toBe(false);
  });

  it("rejects non-string id", () => {
    expect(looksLikeProject({ id: 123, customer: { companyName: "Acme" } })).toBe(false);
  });

  it("rejects missing customer", () => {
    expect(looksLikeProject({ id: "abc" })).toBe(false);
  });

  it("rejects non-object customer", () => {
    expect(looksLikeProject({ id: "abc", customer: "Acme" })).toBe(false);
  });

  it("rejects missing customer.companyName", () => {
    expect(looksLikeProject({ id: "abc", customer: { industry: "fintech" } })).toBe(false);
  });
});

// ── parseBoundedJson ───────────────────────────────────────────────────────

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
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
    const req = makeRequest("{}", { "content-length": String(MAX_BODY_BYTES + 1) });
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
});
