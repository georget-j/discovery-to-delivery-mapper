// Client-side embedding helper. Splits an arbitrary text array into batches
// of `BATCH_SIZE`, posts them serially to /api/embed, and surfaces progress
// to the caller. Sequential (not parallel) by design: the OpenAI tier-1
// rate limit is shared across the project and serial keeps memory bounded
// while still letting doc-level parallelism in useIntakeQueue do the
// throughput work.

const BATCH_SIZE = 50;
const MAX_NETWORK_RETRIES = 2;

export type EmbedClientError = {
  reason:
    | "no_api_key"
    | "rate_limited"
    | "too_large"
    | "invalid_input"
    | "network"
    | "upstream"
    | "aborted";
  message: string;
};

export type EmbedResult = {
  embeddings: Float32Array[];
  tokensUsed: number;
};

export type EmbedOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

export async function embedBatched(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<EmbedResult> {
  const { signal, onProgress } = opts;
  const total = texts.length;
  const embeddings: Float32Array[] = new Array(total);
  let tokensUsed = 0;
  let done = 0;

  for (let start = 0; start < total; start += BATCH_SIZE) {
    if (signal?.aborted) throw abortError();
    const batch = texts.slice(start, start + BATCH_SIZE);
    const result = await postBatchWithRetry(batch, signal);
    for (let i = 0; i < result.embeddings.length; i++) {
      embeddings[start + i] = result.embeddings[i];
    }
    tokensUsed += result.tokensUsed;
    done += batch.length;
    onProgress?.(done, total);
  }

  return { embeddings, tokensUsed };
}

async function postBatchWithRetry(
  texts: string[],
  signal: AbortSignal | undefined,
): Promise<{ embeddings: Float32Array[]; tokensUsed: number }> {
  let attempt = 0;
  let lastErr: EmbedClientError | null = null;
  while (attempt <= MAX_NETWORK_RETRIES) {
    if (signal?.aborted) throw abortError();
    try {
      const res = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
        signal,
      });
      const json = (await res.json()) as
        | {
            embeddings?: number[][];
            tokensUsed?: number;
            error?: string;
            message?: string;
          }
        | undefined;

      if (json?.error) {
        const err: EmbedClientError = {
          reason: mapErrorReason(json.error),
          message: json.message ?? json.error,
        };
        if (err.reason === "rate_limited" && attempt < MAX_NETWORK_RETRIES) {
          await sleep(backoff(attempt));
          attempt++;
          lastErr = err;
          continue;
        }
        throw err;
      }
      if (!res.ok || !json?.embeddings) {
        throw {
          reason: "upstream",
          message: `embed call failed (status ${res.status})`,
        } satisfies EmbedClientError;
      }

      const embeddings = json.embeddings.map((arr) => Float32Array.from(arr));
      return { embeddings, tokensUsed: json.tokensUsed ?? 0 };
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw abortError();
      if (isEmbedError(err)) {
        // Already typed — surface or retry per reason.
        if (err.reason === "rate_limited" && attempt < MAX_NETWORK_RETRIES) {
          await sleep(backoff(attempt));
          attempt++;
          lastErr = err;
          continue;
        }
        throw err;
      }
      lastErr = {
        reason: "network",
        message: err instanceof Error ? err.message : "network error",
      };
      if (attempt < MAX_NETWORK_RETRIES) {
        await sleep(backoff(attempt));
        attempt++;
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? { reason: "upstream", message: "exhausted retries" };
}

function mapErrorReason(error: string): EmbedClientError["reason"] {
  switch (error) {
    case "no_api_key":
      return "no_api_key";
    case "rate_limited":
      return "rate_limited";
    case "too_large":
      return "too_large";
    case "invalid_input":
      return "invalid_input";
    case "upstream":
      return "upstream";
    default:
      return "upstream";
  }
}

function isEmbedError(value: unknown): value is EmbedClientError {
  return (
    !!value &&
    typeof value === "object" &&
    "reason" in (value as Record<string, unknown>) &&
    "message" in (value as Record<string, unknown>)
  );
}

function abortError(): EmbedClientError {
  return { reason: "aborted", message: "Embedding cancelled" };
}

function backoff(attempt: number): number {
  return 750 * 2 ** attempt + Math.floor(Math.random() * 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
