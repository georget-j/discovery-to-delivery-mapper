// Central model registry. Every API route reads its model id from here so a
// model migration is one edit (or one env var) instead of fifteen.
//
// Defaults adopted from the June 2026 model review: gpt-5.4-mini for
// schema-critical generation, gpt-5.4-nano for low-stakes classification/
// captioning, gpt-4o-transcribe over whisper-1 (same price, ~22% lower WER).
// Override via env to roll back without a deploy (e.g. LLM_CHAT_MODEL=gpt-4o-mini).
// Do NOT change the embedding model casually: 1536-dim vectors are persisted
// in every user's IndexedDB knowledge base, and a new model orphans them all.
export const MODELS = {
  // Generation, extraction, chat, recommendations.
  chat: process.env.LLM_CHAT_MODEL ?? "gpt-5.4-mini",
  // Low-stakes classification/captioning (workflow review, doc summaries, vision).
  cheap: process.env.LLM_CHEAP_MODEL ?? "gpt-5.4-nano",
  embed: process.env.LLM_EMBED_MODEL ?? "text-embedding-3-small",
  transcribe: process.env.LLM_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
} as const;

// The GPT-5 family (reasoning models) rejects `temperature` and renamed
// `max_tokens` to `max_completion_tokens`; older chat models do the reverse.
// Routes spread this instead of hard-coding either convention, so the
// registry above (or an env override) can move between families safely.
export function completionParams(
  model: string,
  { temperature, maxTokens }: { temperature?: number; maxTokens?: number },
): Record<string, unknown> {
  const reasoningFamily = /^(gpt-5|o\d)/.test(model);
  if (reasoningFamily) {
    return maxTokens !== undefined ? { max_completion_tokens: maxTokens } : {};
  }
  return {
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  };
}
