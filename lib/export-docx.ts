// Markdown → .docx exporter. Uses `marked` to tokenize the assembled pack
// markdown and the `docx` package to emit a real Word document in the
// browser (Packer.toBlob — no Node Buffer polyfills needed). Both libs are
// dynamically imported so they stay out of the main bundle; the top-level
// `docx` import is type-only and erased at compile time.

import type { Document as DocxDocument } from "docx";
import type { OnboardingProject } from "./types";
import { stripCitationMarkers } from "./artifact-helpers";
import { assembleScopedPack, type PackScope } from "./markdown-export";

export type DocxExportOptions = {
  title?: string;
};

export async function downloadPackDocx(
  project: OnboardingProject,
  scope: PackScope = "full",
): Promise<void> {
  const markdown = assembleScopedPack(project, scope);
  const blob = await markdownToDocxBlob(markdown, {
    title: `Deployment Pack — ${project.customer.companyName}`,
  });
  const slug = project.customer.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  triggerDownload(blob, `${slug || "deployment"}-${scope}-pack.docx`);
}

export async function markdownToDocxBlob(
  markdown: string,
  options: DocxExportOptions = {},
): Promise<Blob> {
  const { Packer } = await import("docx");
  const doc = await markdownToDocxDocument(markdown, options);
  return Packer.toBlob(doc);
}

// Exported for unit testing the token→docx mapping without a DOM — the
// returned Document is an inspectable object tree, not packed binary.
export async function markdownToDocxDocument(
  markdown: string,
  options: DocxExportOptions = {},
): Promise<DocxDocument> {
  const [{ marked }, docx] = await Promise.all([
    import("marked"),
    import("docx"),
  ]);
  const {
    Document,
    Paragraph,
    HeadingLevel,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    Footer,
    PageNumber,
    AlignmentType,
  } = docx;

  // Exported documents have no sources panel for [n] markers to point at.
  const tokens = marked.lexer(stripCitationMarkers(markdown));

  type DocChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: DocChild[] = [];

  const headingFor = (depth: number) => {
    switch (depth) {
      case 1:
        return HeadingLevel.HEADING_1;
      case 2:
        return HeadingLevel.HEADING_2;
      case 3:
        return HeadingLevel.HEADING_3;
      case 4:
        return HeadingLevel.HEADING_4;
      default:
        return HeadingLevel.HEADING_5;
    }
  };

  // Build TextRuns from marked inline tokens (bold / italic / code / plain).
  type InlineToken = {
    type: string;
    text?: string;
    tokens?: InlineToken[];
  };
  function runsFromInline(
    inline: InlineToken[] | undefined,
    fallback: string,
    base: { bold?: boolean } = {},
  ): InstanceType<typeof TextRun>[] {
    if (!inline || inline.length === 0) {
      return [new TextRun({ text: fallback, ...base })];
    }
    const runs: InstanceType<typeof TextRun>[] = [];
    const walk = (
      toks: InlineToken[],
      opts: { bold?: boolean; italics?: boolean; code?: boolean },
    ) => {
      for (const t of toks) {
        if (t.type === "strong") {
          walk(t.tokens ?? [], { ...opts, bold: true });
        } else if (t.type === "em") {
          walk(t.tokens ?? [], { ...opts, italics: true });
        } else if (t.type === "codespan") {
          runs.push(
            new TextRun({ text: t.text ?? "", font: "Courier New", ...opts }),
          );
        } else if (t.type === "br") {
          runs.push(new TextRun({ text: "", break: 1 }));
        } else if (t.tokens && t.tokens.length > 0) {
          walk(t.tokens, opts);
        } else {
          runs.push(new TextRun({ text: t.text ?? "", ...opts }));
        }
      }
    };
    walk(inline, base);
    return runs.length > 0 ? runs : [new TextRun({ text: fallback, ...base })];
  }

  type Tok = {
    type: string;
    depth?: number;
    text?: string;
    tokens?: InlineToken[];
    ordered?: boolean;
    items?: { tokens?: InlineToken[]; text?: string }[];
    header?: { tokens?: InlineToken[]; text?: string }[];
    rows?: { tokens?: InlineToken[]; text?: string }[][];
  };

  // The pack assembler (lib/markdown-export.ts) delimits every artifact with
  // `---` immediately before its `## N. Title` heading — that hr+h2 pair is
  // the page-break signal so artifacts don't flow mid-page into each other.
  let prevWasHr = false;

  for (const tokenRaw of tokens as unknown as Tok[]) {
    const token = tokenRaw;
    switch (token.type) {
      case "heading":
        children.push(
          new Paragraph({
            heading: headingFor(token.depth ?? 2),
            children: runsFromInline(token.tokens, token.text ?? ""),
            pageBreakBefore: token.depth === 2 && prevWasHr,
          }),
        );
        break;
      case "paragraph":
        children.push(
          new Paragraph({
            children: runsFromInline(token.tokens, token.text ?? ""),
            spacing: { after: 120 },
          }),
        );
        break;
      case "list":
        (token.items ?? []).forEach((item, i) => {
          children.push(
            new Paragraph({
              children: runsFromInline(item.tokens, item.text ?? ""),
              bullet: token.ordered ? undefined : { level: 0 },
              numbering: token.ordered
                ? { reference: "ordered", level: 0 }
                : undefined,
              spacing: { after: 40 },
              // Fallback prefix for ordered lists when numbering config absent.
              ...(token.ordered ? {} : {}),
            }),
          );
          void i;
        });
        break;
      case "blockquote":
        children.push(
          new Paragraph({
            children: runsFromInline(token.tokens, token.text ?? ""),
            indent: { left: 360 },
            border: {
              left: {
                color: "CCCCCC",
                space: 12,
                style: BorderStyle.SINGLE,
                size: 12,
              },
            },
            spacing: { after: 120 },
          }),
        );
        break;
      case "table": {
        const headerCells = (token.header ?? []).map(
          (c) =>
            new TableCell({
              children: [
                new Paragraph({
                  // Parsed runs pass through (bolded) — rebuilding from raw
                  // cell text would re-emit literal ** markers.
                  children: runsFromInline(c.tokens, c.text ?? "", {
                    bold: true,
                  }),
                }),
              ],
            }),
        );
        const bodyRows = (token.rows ?? []).map(
          (row) =>
            new TableRow({
              children: row.map(
                (c) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: runsFromInline(c.tokens, c.text ?? ""),
                      }),
                    ],
                  }),
              ),
            }),
        );
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: headerCells }), ...bodyRows],
          }),
        );
        break;
      }
      case "hr":
        children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        break;
      case "space":
        break;
      case "code":
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: token.text ?? "", font: "Courier New" }),
            ],
            spacing: { after: 120 },
          }),
        );
        break;
      default:
        if (token.text) {
          children.push(new Paragraph({ text: token.text }));
        }
    }
    if (token.type !== "space") {
      prevWasHr = token.type === "hr";
    }
  }

  const doc = new Document({
    title: options.title ?? "Deployment Pack",
    creator: "Discovery to Delivery Mapper",
    styles: {
      default: {
        // Run sizes are half-points (22 = 11pt); heading colors follow
        // Word's default blue heading theme.
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { line: 276 } },
        },
        heading1: {
          run: { font: "Calibri Light", size: 40, bold: true, color: "1F3864" },
          paragraph: { spacing: { before: 240, after: 160 } },
        },
        heading2: {
          run: { font: "Calibri Light", size: 30, bold: true, color: "1F3864" },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading3: {
          run: { font: "Calibri Light", size: 26, bold: true, color: "2F5496" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading4: {
          run: { size: 24, bold: true },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
        heading5: {
          run: { size: 22, bold: true, italics: true },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: "start",
            },
          ],
        },
      ],
    },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [
                      "Page ",
                      PageNumber.CURRENT,
                      " of ",
                      PageNumber.TOTAL_PAGES,
                    ],
                    size: 18,
                    color: "808080",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return doc;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
