// URL allowlist for markdown rendered from AI output or uploaded documents.
// A poisoned source document can plant arbitrary links/images in generated
// artifacts, so anything we render with react-markdown must pass through
// artifactUrlTransform (via the urlTransform prop, which covers both anchor
// hrefs and image srcs). Policy: in-document anchors and same-origin paths
// pass, mailto: passes, https passes only for the app's own footer hosts
// (see lib/markdown-export.ts). Everything else — other https hosts, http,
// javascript:, data:, protocol-relative — collapses to "" so react-markdown
// drops the href/src.

export const ALLOWED_LINK_HOSTS: readonly string[] = [
  "discovery-to-delivery-mapper.vercel.app",
  "github.com",
];

export function artifactUrlTransform(url: string): string {
  // Fragment anchors (mini-TOC targets) and same-origin absolute paths carry
  // no host, so they cannot exfiltrate or phish. "//host" is protocol-relative
  // and must NOT match the "/" branch.
  if (url.startsWith("#")) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;

  // new URL() also rejects protocol-relative and bare-relative forms, which
  // is the conservative outcome we want for anything not handled above.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }

  if (parsed.protocol === "mailto:") return url;
  if (
    parsed.protocol === "https:" &&
    ALLOWED_LINK_HOSTS.includes(parsed.hostname)
  ) {
    return url;
  }
  return "";
}
