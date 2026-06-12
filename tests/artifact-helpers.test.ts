import { describe, it, expect } from "vitest";
import { stripCitationMarkers } from "../lib/artifact-helpers";

describe("stripCitationMarkers", () => {
  it("removes numbered citation markers", () => {
    expect(stripCitationMarkers("Cuts review time by 70%[1].")).toBe(
      "Cuts review time by 70%.",
    );
    expect(stripCitationMarkers("Two sources[1][12] here.")).toBe(
      "Two sources here.",
    );
  });

  it("keeps markdown links intact", () => {
    const md = "See [the docs](https://example.com) and [1](https://a.b).";
    expect(stripCitationMarkers(md)).toBe(md);
  });

  it("leaves text without markers unchanged", () => {
    expect(stripCitationMarkers("## Heading\n- bullet")).toBe(
      "## Heading\n- bullet",
    );
  });
});
