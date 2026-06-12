import { describe, it, expect } from "vitest";
import { markdownToDocxDocument } from "../lib/export-docx";

// docx components serialize to nested { rootKey, root: [...] } trees, so the
// token→run mapping is assertable without rendering binary. XML nodes only
// recurse via `root` — their `properties` field aliases the same nodes and
// would double-count; wrapper objects without a rootKey recurse everywhere.
type XmlNode = { rootKey?: string; root?: unknown };

function findAll(node: unknown, rootKey: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n && typeof n === "object") {
      const x = n as XmlNode;
      if (x.rootKey !== undefined) {
        if (x.rootKey === rootKey) out.push(x);
        walk(x.root);
      } else {
        Object.values(n).forEach(walk);
      }
    }
  };
  walk(node);
  return out;
}

function textOf(node: unknown): string {
  return findAll(node, "w:t")
    .map((t) =>
      Array.isArray(t.root)
        ? t.root.filter((c): c is string => typeof c === "string").join("")
        : "",
    )
    .join("");
}

function isBold(run: XmlNode): boolean {
  return findAll(run, "w:b").length > 0;
}

async function toTree(markdown: string): Promise<unknown> {
  const doc = await markdownToDocxDocument(markdown);
  return JSON.parse(JSON.stringify(doc.Document));
}

describe("markdownToDocxDocument table mapping", () => {
  const tableMd = [
    "| **ID** | **User** Name |",
    "| --- | --- |",
    "| R1 | needs **review** |",
  ].join("\n");

  it("emits bold header runs without literal asterisks", async () => {
    const tree = await toTree(tableMd);
    const table = findAll(tree, "w:tbl")[0];
    expect(table).toBeDefined();

    const headerCells = findAll(findAll(table, "w:tr")[0], "w:tc");
    expect(textOf(headerCells[0])).toBe("ID");
    const runs = findAll(headerCells[0], "w:r");
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      expect(isBold(run)).toBe(true);
    }
    expect(textOf(table)).not.toContain("*");
  });

  it("does not duplicate text in multi-token header cells", async () => {
    const tree = await toTree(tableMd);
    const headerCells = findAll(
      findAll(findAll(tree, "w:tbl")[0], "w:tr")[0],
      "w:tc",
    );
    expect(textOf(headerCells[1])).toBe("User Name");
    for (const run of findAll(headerCells[1], "w:r")) {
      expect(isBold(run)).toBe(true);
    }
  });

  it("keeps body cells unbolded except explicit strong spans", async () => {
    const tree = await toTree(tableMd);
    const bodyCells = findAll(
      findAll(findAll(tree, "w:tbl")[0], "w:tr")[1],
      "w:tc",
    );
    const idRuns = findAll(bodyCells[0], "w:r");
    expect(textOf(bodyCells[0])).toBe("R1");
    for (const run of idRuns) {
      expect(isBold(run)).toBe(false);
    }
    const detailRuns = findAll(bodyCells[1], "w:r");
    const boldTexts = detailRuns.filter(isBold).map(textOf);
    expect(boldTexts).toEqual(["review"]);
  });
});

describe("markdownToDocxDocument citation stripping", () => {
  it("strips [n] markers but keeps markdown links", async () => {
    const tree = await toTree(
      "Cuts review time by 70%[3] across teams[12].\n\n" +
        "See [GitHub](https://example.com) for details.",
    );
    const text = textOf(tree);
    expect(text).toContain("Cuts review time by 70% across teams.");
    expect(text).not.toContain("[3]");
    expect(text).not.toContain("[12]");
    expect(text).toContain("GitHub");
  });
});

describe("markdownToDocxDocument pack structure", () => {
  const packMd = [
    "# Deployment Pack — Acme",
    "",
    "**Generated:** today",
    "",
    "---",
    "",
    "## 1. Executive Summary",
    "",
    "Body text.",
    "",
    "### Sub-heading",
    "",
    "More body text.",
    "",
    "---",
    "",
    "## 2. Customer Discovery Summary",
    "",
    "Second artifact.",
  ].join("\n");

  it("page-breaks each artifact heading (h2 after hr) and nothing else", async () => {
    const tree = await toTree(packMd);
    const broken = findAll(tree, "w:p")
      .filter((p) => findAll(p, "w:pageBreakBefore").length > 0)
      .map(textOf);
    expect(broken).toEqual([
      "1. Executive Summary",
      "2. Customer Discovery Summary",
    ]);
  });

  it("sets document title metadata and a page-number footer", async () => {
    const doc = await markdownToDocxDocument(packMd, {
      title: "Deployment Pack — Acme",
    });
    expect(JSON.stringify(doc.CoreProperties)).toContain(
      "Deployment Pack — Acme",
    );
    const footers = JSON.stringify(doc.Footers);
    expect(footers).toContain("PAGE");
    expect(footers).toContain("NUMPAGES");
  });
});
