import { describe, it, expect } from "vitest";
import {
  artifactUrlTransform,
  ALLOWED_LINK_HOSTS,
} from "../lib/markdown-url-policy";

describe("artifactUrlTransform", () => {
  it("allows mailto: links", () => {
    expect(artifactUrlTransform("mailto:csm@example.com")).toBe(
      "mailto:csm@example.com",
    );
  });

  it("allows https links on every allowlisted host", () => {
    for (const host of ALLOWED_LINK_HOSTS) {
      const url = `https://${host}/some/path`;
      expect(artifactUrlTransform(url)).toBe(url);
    }
  });

  it("passes fragment anchors and same-origin paths through", () => {
    expect(artifactUrlTransform("#pilot-success-plan")).toBe(
      "#pilot-success-plan",
    );
    expect(artifactUrlTransform("/print/abc?scope=full")).toBe(
      "/print/abc?scope=full",
    );
  });

  it("blocks https links to hosts off the allowlist", () => {
    expect(artifactUrlTransform("https://evil.example/login")).toBe("");
    // Lookalike: allowlisted host as a subdomain of an attacker domain.
    expect(artifactUrlTransform("https://github.com.evil.example/x")).toBe("");
    // Lookalike: allowlisted host in the userinfo position.
    expect(artifactUrlTransform("https://github.com@evil.example/x")).toBe("");
  });

  it("blocks plain http even for allowlisted hosts", () => {
    expect(artifactUrlTransform("http://github.com/georget-j")).toBe("");
  });

  it("blocks javascript: URLs including obfuscated variants", () => {
    expect(artifactUrlTransform("javascript:alert(1)")).toBe("");
    expect(artifactUrlTransform("JaVaScRiPt:alert(1)")).toBe("");
    expect(artifactUrlTransform("java\nscript:alert(1)")).toBe("");
  });

  it("blocks protocol-relative URLs", () => {
    expect(artifactUrlTransform("//evil.example/phish")).toBe("");
  });

  it("blocks data: URLs", () => {
    expect(
      artifactUrlTransform("data:text/html;base64,PHNjcmlwdD48L3NjcmlwdD4="),
    ).toBe("");
  });
});
