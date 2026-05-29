// Markdown → .docx exporter. Uses `marked` to tokenize the assembled pack
// markdown and the `docx` package to emit a real Word document in the
// browser (Packer.toBlob — no Node Buffer polyfills needed). Both libs are
// dynamically imported so they stay out of the main bundle.

import type { OnboardingProject } from "./types";
import { assembleScopedPack, type PackScope } from "./markdown-export";

export async function downloadPackDocx(
  project: OnboardingProject,
  scope: PackScope = "full",
): Promise<void> {
  const markdown = assembleScopedPack(project, scope);
  const blob = await markdownToDocxBlob(markdown);
  const slug = project.customer.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  triggerDownload(blob, `${slug || "deployment"}-${scope}-pack.docx`);
}

// Exported for unit testing the token→docx mapping without a DOM.
export async function markdownToDocxBlob(markdown: string): Promise<Blob> {
  const [{ marked }, docx] = await Promise.all([
    import("marked"),
    import("docx"),
  ]);
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = docx;

  const tokens = marked.lexer(markdown);

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
  ): InstanceType<typeof TextRun>[] {
    if (!inline || inline.length === 0) {
      return [new TextRun({ text: fallback })];
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
    walk(inline, {});
    return runs.length > 0 ? runs : [new TextRun({ text: fallback })];
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

  for (const tokenRaw of tokens as unknown as Tok[]) {
    const token = tokenRaw;
    switch (token.type) {
      case "heading":
        children.push(
          new Paragraph({
            heading: headingFor(token.depth ?? 2),
            children: runsFromInline(token.tokens, token.text ?? ""),
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
                  children: runsFromInline(c.tokens, c.text ?? "").map(
                    () => new TextRun({ text: c.text ?? "", bold: true }),
                  ),
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
  }

  const doc = new Document({
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
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
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
