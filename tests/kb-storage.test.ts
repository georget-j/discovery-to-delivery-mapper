import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  putDoc,
  getDocs,
  deleteDoc,
  putChunks,
  getProjectChunksWithEmbeddings,
  getProjectChunks,
  getChunksByIds,
  deleteProjectChunks,
} from "@/lib/kb/storage";
import type { KnowledgeBaseDoc } from "@/lib/types";

function mkDoc(overrides: Partial<KnowledgeBaseDoc> = {}): KnowledgeBaseDoc {
  return {
    id: overrides.id ?? "doc-" + Math.random().toString(36).slice(2),
    projectId: overrides.projectId ?? "proj-1",
    name: overrides.name ?? "sample.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    byteSize: overrides.byteSize ?? 1024,
    type: overrides.type ?? "pdf",
    addedAt: overrides.addedAt ?? new Date().toISOString(),
    status: overrides.status ?? "ready",
    chunkCount: overrides.chunkCount ?? 3,
    pageCount: overrides.pageCount,
    sheetCount: overrides.sheetCount,
    source: overrides.source ?? "upload",
    statusDetail: overrides.statusDetail,
  };
}

function mkEmbedding(seed: number): Float32Array {
  const arr = new Float32Array(1536);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = ((seed + i) % 100) / 100;
  }
  return arr;
}

// Use unique project IDs per test so the shared in-memory IDB doesn't bleed
// state between cases.
let testProjectCounter = 0;
let projectA = "p-a-0";
let projectB = "p-b-0";

beforeEach(() => {
  testProjectCounter++;
  projectA = `p-a-${testProjectCounter}`;
  projectB = `p-b-${testProjectCounter}`;
});

describe("kb/storage", () => {
  it("putDoc + getDocs round-trips by projectId", async () => {
    const d1 = mkDoc({ id: "d1", projectId: projectA, name: "a.pdf" });
    const d2 = mkDoc({ id: "d2", projectId: projectA, name: "b.docx" });
    const d3 = mkDoc({ id: "d3", projectId: projectB, name: "other.pdf" });

    await putDoc(d1);
    await putDoc(d2);
    await putDoc(d3);

    const aDocs = await getDocs(projectA);
    expect(aDocs.map((d) => d.id).sort()).toEqual(["d1", "d2"]);

    const bDocs = await getDocs(projectB);
    expect(bDocs.map((d) => d.id)).toEqual(["d3"]);
  });

  it("putChunks persists Float32 embeddings via ArrayBuffer", async () => {
    const docId = "doc-xyz";
    await putDoc(mkDoc({ id: docId, projectId: projectA }));
    await putChunks([
      {
        id: "c1",
        projectId: projectA,
        docId,
        text: "Hello world",
        chunkIndex: 0,
        embedding: mkEmbedding(1),
      },
      {
        id: "c2",
        projectId: projectA,
        docId,
        text: "Second chunk",
        chunkIndex: 1,
        embedding: mkEmbedding(2),
      },
    ]);

    const got = await getProjectChunksWithEmbeddings(projectA);
    expect(got.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    const c1 = got.find((c) => c.id === "c1")!;
    expect(c1.embedding.length).toBe(1536);
    expect(c1.embedding[0]).toBeCloseTo(0.01, 5);
  });

  it("getProjectChunks strips embeddings", async () => {
    const docId = "doc-strip";
    await putDoc(mkDoc({ id: docId, projectId: projectA }));
    await putChunks([
      {
        id: "ce1",
        projectId: projectA,
        docId,
        text: "T",
        chunkIndex: 0,
        embedding: mkEmbedding(3),
      },
    ]);
    const chunks = await getProjectChunks(projectA);
    expect(chunks[0]).not.toHaveProperty("embedding");
  });

  it("getChunksByIds returns only the requested ids", async () => {
    const docId = "doc-by-id";
    await putDoc(mkDoc({ id: docId, projectId: projectA }));
    await putChunks([
      {
        id: "ix1",
        projectId: projectA,
        docId,
        text: "a",
        chunkIndex: 0,
        embedding: mkEmbedding(4),
      },
      {
        id: "ix2",
        projectId: projectA,
        docId,
        text: "b",
        chunkIndex: 1,
        embedding: mkEmbedding(5),
      },
    ]);
    const got = await getChunksByIds(["ix1"]);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe("ix1");
  });

  it("deleteDoc cascades chunks for that doc", async () => {
    const docKeep = "keep-doc";
    const docDrop = "drop-doc";
    await putDoc(mkDoc({ id: docKeep, projectId: projectA }));
    await putDoc(mkDoc({ id: docDrop, projectId: projectA }));
    await putChunks([
      {
        id: "k1",
        projectId: projectA,
        docId: docKeep,
        text: "keep",
        chunkIndex: 0,
        embedding: mkEmbedding(6),
      },
      {
        id: "d1",
        projectId: projectA,
        docId: docDrop,
        text: "drop",
        chunkIndex: 0,
        embedding: mkEmbedding(7),
      },
    ]);

    await deleteDoc(docDrop);

    const docs = await getDocs(projectA);
    expect(docs.map((d) => d.id)).toEqual([docKeep]);

    const chunks = await getProjectChunks(projectA);
    expect(chunks.map((c) => c.id)).toEqual(["k1"]);
  });

  it("deleteProjectChunks wipes both docs and chunks for project", async () => {
    await putDoc(mkDoc({ id: "wipeA1", projectId: projectA }));
    await putDoc(mkDoc({ id: "wipeB1", projectId: projectB }));
    await putChunks([
      {
        id: "wc1",
        projectId: projectA,
        docId: "wipeA1",
        text: "a",
        chunkIndex: 0,
        embedding: mkEmbedding(8),
      },
      {
        id: "wc2",
        projectId: projectB,
        docId: "wipeB1",
        text: "b",
        chunkIndex: 0,
        embedding: mkEmbedding(9),
      },
    ]);

    await deleteProjectChunks(projectA);

    expect(await getDocs(projectA)).toEqual([]);
    expect(await getProjectChunks(projectA)).toEqual([]);
    expect((await getDocs(projectB)).length).toBe(1);
    expect((await getProjectChunks(projectB)).length).toBe(1);
  });

  it("throws when embedding has wrong dimensions", async () => {
    const docId = "bad-emb";
    await putDoc(mkDoc({ id: docId, projectId: projectA }));
    await expect(
      putChunks([
        {
          id: "bad",
          projectId: projectA,
          docId,
          text: "x",
          chunkIndex: 0,
          embedding: new Float32Array(10),
        },
      ]),
    ).rejects.toThrow(/1536/);
  });
});
