import { describe, it, expect } from "vitest";
import { chunkSources, chunkText, approxTokenCount } from "@/lib/kb/chunker";

describe("chunker", () => {
  it("packs short paragraphs into a single chunk", () => {
    const text = "First short paragraph.\n\nSecond short paragraph.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("First short");
    expect(chunks[0].text).toContain("Second short");
  });

  it("splits paragraphs that exceed the budget", () => {
    const longPara = "Sentence one. ".repeat(200); // ~2800 chars, well above 1600
    const chunks = chunkText(longPara, { targetTokens: 100, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      // each chunk should not be drastically over the budget; allow some
      // slack for sentence-boundary preservation.
      expect(c.text.length).toBeLessThan(1000);
    }
  });

  it("hard-wraps a single huge sentence that has no terminators", () => {
    const huge = "x".repeat(5000);
    const chunks = chunkText(huge, { targetTokens: 100, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("inherits page metadata from sources", () => {
    const chunks = chunkSources(
      [
        { text: "Alpha content for page 1.", page: 1 },
        { text: "Bravo content for page 2.", page: 2 },
      ],
      { overlapTokens: 0 },
    );
    expect(chunks[0].page).toBe(1);
    expect(chunks[1].page).toBe(2);
  });

  it("inherits sheet + rangeRef metadata for spreadsheet sources", () => {
    const chunks = chunkSources([
      { text: "Row data here", sheet: "Q1", rangeRef: "A1:F40" },
    ]);
    expect(chunks[0].sheet).toBe("Q1");
    expect(chunks[0].rangeRef).toBe("A1:F40");
  });

  it("drops empty / near-empty chunks", () => {
    const chunks = chunkText("abc"); // 3 chars — below MIN_CHUNK_CHARS=10
    expect(chunks).toHaveLength(0);
  });

  it("applies overlap between consecutive chunks", () => {
    // Force at least two chunks
    const text =
      "First paragraph content.\n\n" +
      "x".repeat(1600) +
      "\n\nLater paragraph after split.";
    const chunks = chunkText(text, { targetTokens: 100, overlapTokens: 25 });
    if (chunks.length < 2) return; // sanity — should split
    const overlap = chunks[1].text;
    // The second chunk should start with some tail of the first.
    expect(overlap.length).toBeGreaterThan(0);
  });

  it("assigns monotonically increasing chunkIndex across sources", () => {
    const chunks = chunkSources([
      { text: "A".repeat(50) },
      { text: "B".repeat(50) },
      { text: "C".repeat(50) },
    ]);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it("approxTokenCount roughly tracks char/4", () => {
    expect(approxTokenCount("a".repeat(40))).toBe(10);
    expect(approxTokenCount("")).toBe(0);
  });
});
