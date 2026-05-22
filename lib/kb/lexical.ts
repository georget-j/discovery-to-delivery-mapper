// Tiny BM25 lexical scorer used to complement vector retrieval. Pure JS,
// no external dependencies. Designed for the small corpus sizes we see
// per-project (typically < 1000 chunks). Builds a corpus index on the
// fly because retrieval is sub-second at this scale and we avoid stale
// index management.

const K1 = 1.5;
const B = 0.75;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "the",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "at",
  "we",
  "our",
  "their",
  "they",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_\-]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok));
}

export type LexicalScored<T> = { doc: T; score: number };

// Score every doc in `corpus` against `query`, returning normalised
// scores in [0, 1].
export function bm25Score<T extends { text: string }>(
  corpus: T[],
  query: string,
): LexicalScored<T>[] {
  if (corpus.length === 0) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return corpus.map((doc) => ({ doc, score: 0 }));
  }

  const docTokens: string[][] = corpus.map((c) => tokenize(c.text));
  const N = corpus.length;
  const avgdl =
    docTokens.reduce((sum, toks) => sum + toks.length, 0) / Math.max(1, N);

  // Document frequency per query token.
  const df: Record<string, number> = {};
  for (const tok of new Set(queryTokens)) {
    let count = 0;
    for (const dt of docTokens) {
      if (dt.includes(tok)) count++;
    }
    df[tok] = count;
  }

  const raw: number[] = corpus.map((_, i) => {
    const dt = docTokens[i];
    const dl = dt.length;
    if (dl === 0) return 0;
    const tf: Record<string, number> = {};
    for (const t of dt) tf[t] = (tf[t] ?? 0) + 1;
    let score = 0;
    for (const q of queryTokens) {
      const f = tf[q] ?? 0;
      if (f === 0) continue;
      const n = df[q] ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + K1 * (1 - B + B * (dl / avgdl));
      score += idf * ((f * (K1 + 1)) / denom);
    }
    return score;
  });

  const max = Math.max(...raw, 0);
  if (max === 0) return corpus.map((doc) => ({ doc, score: 0 }));

  return corpus.map((doc, i) => ({ doc, score: raw[i] / max }));
}
