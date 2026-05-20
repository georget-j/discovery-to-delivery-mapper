import { describe, it, expect } from "vitest";
import { cn, formatDate, generateId } from "../lib/utils";

describe("cn", () => {
  it("joins multiple class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("deduplicates conflicting tailwind classes (last wins)", () => {
    // tailwind-merge: bg-red-500 then bg-blue-500 should resolve to bg-blue-500
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toContain("bg-blue-500");
    expect(result).not.toContain("bg-red-500");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO string as DD MMM YYYY (en-GB)", () => {
    const out = formatDate("2026-03-15T12:00:00Z");
    expect(out).toMatch(/15 Mar 2026/);
  });

  it("handles the first day of a month", () => {
    expect(formatDate("2026-01-01T00:00:00Z")).toMatch(/1 Jan 2026/);
  });

  it("handles the last day of a year", () => {
    // Use noon UTC to dodge timezone slop crossing midnight
    expect(formatDate("2026-12-31T12:00:00Z")).toMatch(/31 Dec 2026/);
  });
});

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns id of length 8 (or less if base36 is short)", () => {
    // Implementation: Math.random().toString(36).slice(2, 10) — up to 8 chars
    const id = generateId();
    expect(id.length).toBeLessThanOrEqual(8);
    expect(id.length).toBeGreaterThanOrEqual(1);
  });

  it("ids are highly unique in a batch of 1000", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(generateId());
    // Allow a tiny collision rate but expect near-uniqueness from Math.random
    expect(ids.size).toBeGreaterThan(990);
  });

  it("ids only contain base36 characters (0-9, a-z)", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-z]*$/);
    }
  });
});
