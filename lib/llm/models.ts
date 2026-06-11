// Central model registry. Every API route reads its model id from here so a
// model migration is one edit (or one env var) instead of fifteen.
//
// Defaults are the models the app shipped with. Recommended upgrades from the
// June 2026 model review (set via env to adopt without a deploy):
//   LLM_CHAT_MODEL=gpt-5.4-mini        — better structured-output reliability
//   LLM_CHEAP_MODEL=gpt-5.4-nano       — review/summarize/vision-caption tier
//   LLM_TRANSCRIBE_MODEL=gpt-4o-transcribe — same price as whisper-1, ~22% lower WER
// Do NOT change the embedding model casually: 1536-dim vectors are persisted
// in every user's IndexedDB knowledge base, and a new model orphans them all.
export const MODELS = {
  // Generation, extraction, chat, recommendations.
  chat: process.env.LLM_CHAT_MODEL ?? "gpt-4o-mini",
  // Low-stakes classification/captioning (workflow review, doc summaries, vision).
  cheap: process.env.LLM_CHEAP_MODEL ?? "gpt-4o-mini",
  embed: process.env.LLM_EMBED_MODEL ?? "text-embedding-3-small",
  transcribe: process.env.LLM_TRANSCRIBE_MODEL ?? "whisper-1",
} as const;
