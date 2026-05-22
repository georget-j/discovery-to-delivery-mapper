// Cosine-similarity retrieval over the project's KB chunks.
// Loads all chunks from IDB once per query (typically < 1000 chunks per
// project), embeds the query via /api/embed (single text), and returns
// the top-K most-similar. Embeddings from text-embedding-3-small are
// unit-normalised, so cosine sim collapses to a dot product.

import { embedBatched } from "@/lib/kb/embed-client";
import {
  getProjectChunksWithEmbeddings,
  type ChunkWithEmbedding,
} from "@/lib/kb/storage";
import { getDocs } from "@/lib/kb/storage";
import type { KnowledgeBaseChunk, KnowledgeBaseDoc } from "@/lib/types";
import { queriesForTarget, type GenerationTarget } from "./query-templates";
import { bm25Score } from "./lexical";

// Hybrid scoring weight — 70% vector, 30% lexical. Vector dominates
// because it captures semantic intent; lexical adds robustness on
// exact tool/product names that vector embeddings can blur.
const VECTOR_WEIGHT = 0.7;
const LEXICAL_WEIGHT = 0.3;

const DEFAULT_TOP_K = 8;
const MIN_SIMILARITY = 0.3;

export type Retrieved = {
  chunk: KnowledgeBaseChunk;
  similarity: number;
  doc: KnowledgeBaseDoc;
  label: string;
};

export async function retrieve(
  projectId: string,
  query: string,
  k: number = DEFAULT_TOP_K,
): Promise<Retrieved[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { embeddings } = await embedBatched([trimmed]);
  const queryVec = embeddings[0];
  if (!queryVec || queryVec.length === 0) return [];

  const [chunks, docs] = await Promise.all([
    getProjectChunksWithEmbeddings(projectId),
    getDocs(projectId),
  ]);
  if (chunks.length === 0) return [];

  const docById = new Map<string, KnowledgeBaseDoc>(docs.map((d) => [d.id, d]));

  // Vector similarity for every chunk.
  const vectorScored = chunks.map((c) => ({
    chunk: c,
    vector: dotProduct(queryVec, c.embedding),
  }));
  // BM25 lexical similarity (already normalised to [0, 1]).
  const lexical = bm25Score(
    chunks.map((c) => ({ id: c.id, text: c.text })),
    trimmed,
  );
  const lexicalById = new Map(lexical.map((l) => [l.doc.id, l.score]));

  // Normalise vector scores to [0, 1] for blending. Vectors from
  // text-embedding-3-small are unit-length so similarity sits in [-1, 1];
  // clamp to [0, 1] which loses negatives (effectively zero relevance).
  const scored = vectorScored
    .map((r) => {
      const v = Math.max(0, r.vector);
      const lex = lexicalById.get(r.chunk.id) ?? 0;
      const similarity = VECTOR_WEIGHT * v + LEXICAL_WEIGHT * lex;
      return { chunk: r.chunk, similarity };
    })
    .filter((r) => r.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);

  return scored.map(({ chunk, similarity }) => {
    const doc = docById.get(chunk.docId);
    return {
      chunk: stripEmbedding(chunk),
      similarity,
      doc: doc ?? makeFallbackDoc(chunk),
      label: formatLabel(chunk, doc),
    };
  });
}

// Multi-target retrieval. Embeds each query, runs retrieval for each, then
// dedupes by chunk id (a single chunk often satisfies multiple categories).
export async function retrieveForTarget(
  projectId: string,
  target: GenerationTarget,
  k: number = DEFAULT_TOP_K,
): Promise<Retrieved[]> {
  const queries = queriesForTarget(target);
  if (queries.length === 1) return retrieve(projectId, queries[0], k);

  const perQueryK = Math.max(3, Math.ceil(k / queries.length));
  const results = await Promise.all(
    queries.map((q) => retrieve(projectId, q, perQueryK)),
  );

  const merged = new Map<string, Retrieved>();
  for (const list of results) {
    for (const item of list) {
      const existing = merged.get(item.chunk.id);
      if (!existing || item.similarity > existing.similarity) {
        merged.set(item.chunk.id, item);
      }
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(k, queries.length * 2));
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

function stripEmbedding(c: ChunkWithEmbedding): KnowledgeBaseChunk {
  const { embedding: _embedding, ...rest } = c;
  return rest;
}

function formatLabel(
  chunk: KnowledgeBaseChunk,
  doc: KnowledgeBaseDoc | undefined,
): string {
  const docName = doc?.name ?? "doc";
  const parts: string[] = [docName];
  if (chunk.page !== undefined) parts.push(`p.${chunk.page}`);
  if (chunk.sheet) parts.push(chunk.sheet);
  if (chunk.rangeRef) parts.push(chunk.rangeRef);
  return parts.join(" · ");
}

function makeFallbackDoc(chunk: KnowledgeBaseChunk): KnowledgeBaseDoc {
  return {
    id: chunk.docId,
    projectId: chunk.projectId,
    name: "Unknown document",
    mimeType: "application/octet-stream",
    byteSize: 0,
    type: "txt",
    addedAt: "",
    status: "ready",
    chunkCount: 0,
    source: "upload",
  };
}
