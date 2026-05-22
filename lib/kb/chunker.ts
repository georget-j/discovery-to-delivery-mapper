// Splits raw text into embedding-friendly chunks. Cascade:
//   1. Paragraph splitter, greedy-pack ≤ targetTokens.
//   2. If a paragraph itself exceeds the budget, sentence-split it.
//   3. If a sentence still exceeds the budget, hard-wrap on the char boundary.
// Each chunk inherits the source's page/sheet/range metadata so retrieval
// can cite back to a precise location in the original document.

import type { KnowledgeBaseChunk } from "@/lib/types";

const APPROX_CHARS_PER_TOKEN = 4;

const DEFAULT_TARGET_TOKENS = 400;
const DEFAULT_OVERLAP_TOKENS = 50;
const MAX_TOKENS_HARD_CAP = 7800; // below the 8192 embedding ceiling, leaves room for tokenizer slack
const MIN_CHUNK_CHARS = 10;

export type ChunkSource = {
  text: string;
  page?: number;
  sheet?: string;
  rangeRef?: string;
};

export type ChunkerOptions = {
  targetTokens?: number;
  overlapTokens?: number;
};

export type ChunkBlueprint = Omit<
  KnowledgeBaseChunk,
  "id" | "projectId" | "docId"
>;

// ── Public API ──────────────────────────────────────────────────────────────

export function chunkSources(
  sources: ChunkSource[],
  opts: ChunkerOptions = {},
): ChunkBlueprint[] {
  const targetTokens = opts.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const targetChars = targetTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * APPROX_CHARS_PER_TOKEN;

  const out: ChunkBlueprint[] = [];
  let chunkIndex = 0;

  for (const source of sources) {
    const text = source.text?.trim();
    if (!text) continue;

    const chunks = splitToBudget(text, targetChars, overlapChars);
    for (const chunkText of chunks) {
      const clean = chunkText.trim();
      if (clean.length < MIN_CHUNK_CHARS) continue;
      const capped = capToHardLimit(clean);
      out.push({
        text: capped,
        page: source.page,
        sheet: source.sheet,
        rangeRef: source.rangeRef,
        chunkIndex: chunkIndex++,
      });
    }
  }

  return out;
}

// Single-source convenience used by raw-text / DOCX paths that have no
// page or sheet metadata to thread through.
export function chunkText(
  text: string,
  opts: ChunkerOptions = {},
): ChunkBlueprint[] {
  return chunkSources([{ text }], opts);
}

// ── Internals ───────────────────────────────────────────────────────────────

function splitToBudget(
  text: string,
  targetChars: number,
  overlapChars: number,
): string[] {
  // Step 1: paragraph splitter. Treat \n{2,} as a paragraph boundary; also
  // collapse leading/trailing whitespace per paragraph so packing is tight.
  const paragraphs = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  // Greedy pack paragraphs.
  const packed = greedyPack(paragraphs, targetChars);

  // Step 2 & 3: any oversized packed chunk needs sentence-splitting or
  // hard-wrapping. Run the cascade on each.
  const refined: string[] = [];
  for (const candidate of packed) {
    if (candidate.length <= targetChars) {
      refined.push(candidate);
      continue;
    }
    refined.push(...sentenceSplitAndPack(candidate, targetChars));
  }

  // Apply overlap by prepending the tail of the previous chunk to the next.
  return applyOverlap(refined, overlapChars);
}

function greedyPack(units: string[], budget: number): string[] {
  const out: string[] = [];
  let current = "";

  for (const u of units) {
    if (!current) {
      current = u;
      continue;
    }
    const joined = `${current}\n\n${u}`;
    if (joined.length <= budget) {
      current = joined;
    } else {
      out.push(current);
      current = u;
    }
  }
  if (current) out.push(current);
  return out;
}

function sentenceSplitAndPack(text: string, budget: number): string[] {
  // Split on sentence terminators followed by whitespace, OR single newlines
  // (catches bulleted lists where each line is its own clause).
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const packed = greedyPack(sentences, budget);

  // Any sentence that is itself bigger than budget gets hard-wrapped.
  const out: string[] = [];
  for (const c of packed) {
    if (c.length <= budget) {
      out.push(c);
    } else {
      out.push(...hardWrap(c, budget));
    }
  }
  return out;
}

function hardWrap(text: string, budget: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += budget) {
    out.push(text.slice(i, i + budget));
  }
  return out;
}

function applyOverlap(chunks: string[], overlapChars: number): string[] {
  if (chunks.length <= 1 || overlapChars <= 0) return chunks;
  const out: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1];
    const tail = prev.slice(Math.max(0, prev.length - overlapChars));
    out.push(`${tail} ${chunks[i]}`.trim());
  }
  return out;
}

function capToHardLimit(text: string): string {
  const maxChars = MAX_TOKENS_HARD_CAP * APPROX_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

// ── Heuristic token counter (no external dep on hot paths) ─────────────────
// Useful when callers want a rough budget estimate without paying for the
// full tokenizer. For exact counts the caller can import gpt-tokenizer
// directly (server-side / one-shot).
export function approxTokenCount(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}
