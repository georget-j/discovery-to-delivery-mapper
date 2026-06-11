import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { generateValidatedJson } from "../lib/llm/generate-json";

const Schema = z.object({ name: z.string(), count: z.number() });

function openAIResponse(content: string, finishReason = "stop"): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finishReason }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function callOpts() {
  return {
    apiKey: "sk-test",
    system: "sys",
    user: "user",
    schema: Schema,
    timeoutMs: 5000,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateValidatedJson", () => {
  it("returns validated data on a clean first response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(openAIResponse('{"name":"a","count":1}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateValidatedJson(callOpts());
    expect(result).toEqual({
      ok: true,
      data: { name: "a", count: 1 },
      repaired: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("repairs a near-miss response with one extra round-trip", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openAIResponse('{"name":"a","count":"one"}'))
      .mockResolvedValueOnce(openAIResponse('{"name":"a","count":1}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateValidatedJson(callOpts());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.repaired).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The repair call includes the failed output and the schema issues.
    const repairBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(repairBody.messages).toHaveLength(4);
    expect(repairBody.messages[2].role).toBe("assistant");
    expect(repairBody.messages[3].content).toContain("count");
  });

  it("gives up after a failed repair and hands back the raw output for salvage", async () => {
    // Mint a fresh Response per call — bodies are single-use.
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        openAIResponse('{"name":"a","count":"one"}'),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateValidatedJson(callOpts());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_output");
      expect(result.raw).toEqual({ name: "a", count: "one" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports truncation distinctly instead of crashing on partial JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(openAIResponse('{"name":"a","cou', "length"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateValidatedJson(callOpts());
    expect(result).toMatchObject({ ok: false, error: "truncated" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps upstream 429 to rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("slow down", { status: 429 })),
    );
    const result = await generateValidatedJson(callOpts());
    expect(result).toMatchObject({ ok: false, error: "rate_limited" });
  });

  it("maps other upstream failures to upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );
    const result = await generateValidatedJson(callOpts());
    expect(result).toMatchObject({ ok: false, error: "upstream" });
  });

  it("reports a timeout distinctly", async () => {
    const abort = new Error("The operation timed out");
    abort.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    const result = await generateValidatedJson(callOpts());
    expect(result).toMatchObject({ ok: false, error: "timeout" });
  });

  it("reports unparseable first responses as invalid_json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(openAIResponse("not json at all")),
    );
    const result = await generateValidatedJson(callOpts());
    expect(result).toMatchObject({ ok: false, error: "invalid_json" });
  });

  it("reports empty responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [] }), { status: 200 }),
        ),
    );
    const result = await generateValidatedJson(callOpts());
    expect(result).toMatchObject({ ok: false, error: "empty" });
  });
});
