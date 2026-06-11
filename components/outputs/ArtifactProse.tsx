"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { SourceChip } from "@/components/outputs/SourceChip";
import { artifactUrlTransform } from "@/lib/markdown-url-policy";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  onChipClick: () => void;
};

// Shared renderer for generated artifacts. Adds three things over a bare
// ReactMarkdown: [N] source chips, emoji-keyed callout styling on
// blockquotes, and a sticky mini-TOC derived from the ## headings on long
// documents. Extracted from the Outputs page so the print view and any
// future surfaces render artifacts identically.

const PROSE = cn(
  "prose prose-sm max-w-none text-foreground",
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-6",
  "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1.5",
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2",
  "[&_p]:leading-relaxed",
  "[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_code]:text-xs",
  "[&_table]:w-full [&_table]:border-collapse",
  "[&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:pb-2 [&_th]:px-2",
  "[&_td]:py-1.5 [&_td]:px-2 [&_td]:text-sm [&_td]:align-top",
  "[&_tbody_tr]:border-b [&_tbody_tr]:border-border/50",
  "[&_tbody_tr:nth-child(even)]:bg-muted/30",
  "[&_ul]:space-y-1 [&_li]:leading-relaxed [&_input[type=checkbox]]:mr-2",
);

export function ArtifactProse({ content, onChipClick }: Props) {
  const toc = useMemo(() => extractToc(content), [content]);

  const renderChips = (children: ReactNode): ReactNode =>
    renderChildrenWithChips(children, onChipClick);

  return (
    <div className={toc.length >= 3 ? "lg:flex lg:gap-6" : undefined}>
      {toc.length >= 3 && (
        <nav
          aria-label="On this page"
          className="hidden lg:block w-44 shrink-0 self-start sticky top-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            On this page
          </p>
          <ul className="space-y-1 border-l border-border">
            {toc.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className="block text-xs text-muted-foreground hover:text-foreground -ml-px pl-3 border-l border-transparent hover:border-foreground/40 py-0.5 transition-colors"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className={cn(PROSE, "min-w-0 flex-1")}>
        <ReactMarkdown
          urlTransform={artifactUrlTransform}
          components={{
            h2: ({ children }) => (
              <h2 id={slugify(nodeText(children))}>{children}</h2>
            ),
            p: ({ children }) => <p>{renderChips(children)}</p>,
            li: ({ children }) => <li>{renderChips(children)}</li>,
            td: ({ children }) => <td>{renderChips(children)}</td>,
            blockquote: ({ children }) => <Callout>{children}</Callout>,
            // Defence in depth on top of urlTransform: an off-allowlist href
            // (already collapsed to "") renders as plain text, not a link.
            a: ({ href, children }) => {
              const safe = artifactUrlTransform(href ?? "");
              return safe ? (
                <a href={safe}>{children}</a>
              ) : (
                <span>{children}</span>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── Callouts ────────────────────────────────────────────────────────────────
// Blockquotes are upgraded to coloured callouts keyed by their leading emoji.
// Anything else falls back to the neutral (amber) quote style.

const CALLOUT_VARIANTS: { match: RegExp; cls: string }[] = [
  {
    match: /^(⚠|❗|🚨)/u,
    cls: "border-orange-300 bg-orange-50 text-orange-900",
  },
  {
    match: /^(✅|✔)/u,
    cls: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  { match: /^(ℹ|💡|🔑|📌)/u, cls: "border-sky-300 bg-sky-50 text-sky-900" },
];

function Callout({ children }: { children: ReactNode }) {
  const text = nodeText(children).trim();
  const variant = CALLOUT_VARIANTS.find((v) => v.match.test(text));
  return (
    <blockquote
      className={cn(
        "not-prose my-3 rounded-md border-l-4 px-4 py-2.5 text-sm leading-relaxed",
        variant
          ? variant.cls
          : "border-amber-300 bg-amber-50/60 text-muted-foreground italic",
      )}
    >
      {children}
    </blockquote>
  );
}

// ── Source chips ([N] → clickable) ───────────────────────────────────────────

function renderChildrenWithChips(
  children: ReactNode,
  onChipClick: () => void,
): ReactNode {
  if (typeof children === "string") {
    const parts: ReactNode[] = [];
    const re = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(children)) !== null) {
      if (match.index > lastIndex)
        parts.push(children.slice(lastIndex, match.index));
      parts.push(
        <SourceChip
          key={`chip-${match.index}`}
          n={parseInt(match[1], 10)}
          onClick={onChipClick}
        />,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < children.length) parts.push(children.slice(lastIndex));
    return parts.length === 1 ? parts[0] : parts;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{renderChildrenWithChips(c, onChipClick)}</Fragment>
    ));
  }
  return children;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText(
      (node as { props: { children?: ReactNode } }).props.children,
    );
  }
  return "";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function extractToc(markdown: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/[#*`]/g, "").trim();
    let id = slugify(text);
    if (!id) continue;
    // De-dup ids so anchors stay unique.
    let unique = id;
    let i = 2;
    while (seen.has(unique)) unique = `${id}-${i++}`;
    seen.add(unique);
    id = unique;
    out.push({ id, text });
  }
  return out;
}
