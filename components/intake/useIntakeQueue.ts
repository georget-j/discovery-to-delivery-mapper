"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { generateId } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { embedBatched } from "@/lib/kb/embed-client";
import {
  putChunks,
  putDoc,
  deleteDoc,
  getProjectChunksWithEmbeddings,
} from "@/lib/kb/storage";
import { approxTokenCount, chunkSources, chunkText } from "@/lib/kb/chunker";
import {
  MAX_FILE_BYTES,
  MAX_PARALLEL_PARSE,
  detectDocType,
  type ParserRequest,
  type ParserResponse,
} from "@/lib/kb/parser-protocol";
import type {
  KnowledgeBaseDoc,
  KnowledgeBaseDocStatus,
  KnowledgeBaseDocType,
  KnowledgeBaseSummary,
  OnboardingProject,
} from "@/lib/types";

const MAX_FILES_PER_DROP = 10;

export type IntakeJob = {
  id: string; // promoted to docId once persisted
  name: string;
  byteSize: number;
  type: KnowledgeBaseDocType;
  status: KnowledgeBaseDocStatus;
  progress: number; // 0..1
  statusDetail?: string;
  stage?: "parsing" | "chunking" | "embedding";
  file?: File; // null for raw-text pastes
  rawText?: string;
  // When set, the user can hit "Retry" without re-uploading the file.
  recoverable: boolean;
  // Bookkeeping for embedding so retries skip re-parse.
  pendingChunkBlueprints?: import("@/lib/kb/chunker").ChunkBlueprint[];
  pageCount?: number;
  sheetCount?: number;
  // Cancellation handle for in-flight embedding fetch.
  embeddingAbort?: AbortController;
};

export type EnqueueInput =
  | { files: File[] }
  | { rawText: string; name?: string };

export type IntakeQueueApi = {
  jobs: IntakeJob[];
  enqueue: (input: EnqueueInput) => void;
  cancel: (jobId: string) => void;
  retry: (jobId: string) => void;
  remove: (jobId: string) => void;
  summarise: (jobId: string) => Promise<void>;
  summaries: Record<string, string>;
  runOcr: (jobId: string) => Promise<void>;
  runVision: (jobId: string) => Promise<void>;
  reprocessFromText: (jobId: string, text: string) => Promise<void>;
  readText: (jobId: string) => Promise<string>;
  totals: { docs: number; chunks: number; tokens: number };
  parsingCount: number;
  embeddingCount: number;
  hasReadyDocs: boolean;
};

export function useIntakeQueue(): IntakeQueueApi {
  const { project, updateProject } = useWorkspace();
  const projectId = project?.id ?? "";

  const [jobs, setJobs] = useState<IntakeJob[]>([]);
  const jobsRef = useRef<IntakeJob[]>(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const workerRef = useRef<Worker | null>(null);

  // Worker is created lazily so SSR doesn't see `window`.
  const ensureWorker = useCallback((): Worker | null => {
    if (typeof window === "undefined") return null;
    if (workerRef.current) return workerRef.current;
    const w = new Worker(
      new URL("../../workers/parser.worker.ts", import.meta.url),
      { type: "module" },
    );
    w.onmessage = (event: MessageEvent<ParserResponse>) =>
      handleWorkerMessage(event.data);
    w.onerror = (event) => {
      console.error("Worker error", event);
    };
    workerRef.current = w;
    return w;
  }, []);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  // ── State helpers ──────────────────────────────────────────────────────

  const updateJob = useCallback(
    (
      jobId: string,
      patch: Partial<IntakeJob> | ((j: IntakeJob) => IntakeJob),
    ) =>
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? typeof patch === "function"
              ? patch(j)
              : { ...j, ...patch }
            : j,
        ),
      ),
    [],
  );

  const removeJob = useCallback(
    (jobId: string) => setJobs((prev) => prev.filter((j) => j.id !== jobId)),
    [],
  );

  // ── Worker message handling ────────────────────────────────────────────

  const handleWorkerMessage = useCallback(
    async (msg: ParserResponse) => {
      switch (msg.type) {
        case "progress":
          updateJob(msg.jobId, {
            stage: msg.stage,
            progress: msg.progress,
            status: msg.stage === "chunking" ? "chunking" : "parsing",
          });
          break;
        case "error":
          updateJob(msg.jobId, {
            status: "failed",
            statusDetail: msg.message,
            recoverable: msg.recoverable,
          });
          await persistDoc(msg.jobId);
          break;
        case "result":
          updateJob(msg.jobId, (j) => ({
            ...j,
            status: "embedding",
            progress: 0,
            stage: "embedding",
            pendingChunkBlueprints: msg.chunks,
            pageCount: msg.pageCount,
            sheetCount: msg.sheetCount,
          }));
          // The embedding dispatcher effect picks this up.
          break;
      }
    },
    [updateJob],
  );

  // ── Doc metadata persistence ───────────────────────────────────────────

  const persistDoc = useCallback(
    async (jobId: string) => {
      const j = jobsRef.current.find((x) => x.id === jobId);
      if (!j || !projectId) return;
      const doc: KnowledgeBaseDoc = {
        id: j.id,
        projectId,
        name: j.name,
        mimeType: j.file?.type ?? "text/plain",
        byteSize: j.byteSize,
        type: j.type,
        addedAt: new Date().toISOString(),
        status: j.status,
        statusDetail: j.statusDetail,
        chunkCount: j.pendingChunkBlueprints?.length ?? 0,
        pageCount: j.pageCount,
        sheetCount: j.sheetCount,
        source: j.file ? "upload" : "paste",
      };
      try {
        await putDoc(doc);
      } catch (err) {
        console.error("Failed to persist doc metadata", err);
      }
    },
    [projectId],
  );

  // ── Dispatcher: send queued jobs to the worker ────────────────────────

  useEffect(() => {
    const w = ensureWorker();
    if (!w) return;
    const queued = jobs.filter((j) => j.status === "queued");
    const inFlight = jobs.filter(
      (j) => j.status === "parsing" || j.status === "chunking",
    ).length;
    const slots = MAX_PARALLEL_PARSE - inFlight;
    if (slots <= 0 || queued.length === 0) return;

    for (const job of queued.slice(0, slots)) {
      // Promote to parsing first so the dispatcher doesn't re-queue.
      updateJob(job.id, { status: "parsing", progress: 0, stage: "parsing" });
      void dispatchParse(job, w);
    }
  }, [jobs, ensureWorker, updateJob]);

  const dispatchParse = useCallback(
    async (job: IntakeJob, w: Worker) => {
      try {
        let data: ArrayBuffer;
        if (job.file) {
          data = await job.file.arrayBuffer();
        } else if (job.rawText !== undefined) {
          data = new TextEncoder().encode(job.rawText).buffer;
        } else {
          updateJob(job.id, {
            status: "failed",
            statusDetail: "No file or text payload.",
            recoverable: false,
          });
          return;
        }
        const ext = (job.name.split(".").pop() ?? "").toLowerCase();
        const req: ParserRequest = {
          type: "parse",
          jobId: job.id,
          data,
          mimeType: job.file?.type ?? "text/plain",
          ext,
          docType: job.type,
          name: job.name,
        };
        w.postMessage(req, [data]);
      } catch (err) {
        updateJob(job.id, {
          status: "failed",
          statusDetail:
            err instanceof Error ? err.message : "Failed to read file",
          recoverable: true,
        });
      }
    },
    [updateJob],
  );

  // ── Dispatcher: run embedding for any jobs in "embedding" status ──────
  // Serial across the queue (single OpenAI rate-limit pool).

  const embeddingInProgress = useRef<Set<string>>(new Set());

  useEffect(() => {
    const target = jobs.find(
      (j) =>
        j.status === "embedding" &&
        j.pendingChunkBlueprints &&
        !embeddingInProgress.current.has(j.id),
    );
    if (!target || !projectId) return;
    embeddingInProgress.current.add(target.id);
    void runEmbedding(target);
    // We intentionally exclude runEmbedding from deps — closure captures fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, projectId]);

  const runEmbedding = useCallback(
    async (job: IntakeJob) => {
      const blueprints = job.pendingChunkBlueprints ?? [];
      if (blueprints.length === 0) {
        updateJob(job.id, {
          status: "ready",
          statusDetail: undefined,
          progress: 1,
        });
        await persistDoc(job.id);
        bumpKbTotals();
        embeddingInProgress.current.delete(job.id);
        return;
      }

      const controller = new AbortController();
      updateJob(job.id, { embeddingAbort: controller });

      try {
        const { embeddings, tokensUsed } = await embedBatched(
          blueprints.map((b) => b.text),
          {
            signal: controller.signal,
            onProgress: (done, total) =>
              updateJob(job.id, {
                progress: done / total,
                stage: "embedding",
                status: "embedding",
              }),
          },
        );

        const persisted = blueprints.map((b, i) => ({
          ...b,
          id: `${job.id}-c${i}`,
          projectId,
          docId: job.id,
          embedding: embeddings[i],
        }));
        await putChunks(persisted);

        updateJob(job.id, {
          status: "ready",
          progress: 1,
          statusDetail: undefined,
          embeddingAbort: undefined,
        });
        await persistDoc(job.id);

        addTokensToTotals(tokensUsed);
        bumpKbTotals(blueprints.length, job);
      } catch (err) {
        const reason = (err as { reason?: string })?.reason;
        const message =
          (err as { message?: string })?.message ?? "Embedding failed";
        const recoverable = reason !== "no_api_key" && reason !== "aborted";
        if (reason === "aborted") {
          // User cancelled — clean up silently.
          embeddingInProgress.current.delete(job.id);
          return;
        }
        updateJob(job.id, {
          status: "failed",
          statusDetail:
            reason === "no_api_key"
              ? "OPENAI_API_KEY missing on the server. Set it and retry."
              : `Embedding failed: ${message}`,
          recoverable,
          embeddingAbort: undefined,
        });
        await persistDoc(job.id);
      } finally {
        embeddingInProgress.current.delete(job.id);
      }
    },
    [persistDoc, projectId, updateJob],
  );

  // ── KB summary mirror on project ──────────────────────────────────────

  const bumpKbTotals = useCallback(
    (newChunks?: number, job?: IntakeJob) => {
      if (!project) return;
      const existing: KnowledgeBaseSummary = project.knowledgeBase ?? {
        docs: [],
        totalChunks: 0,
        totalTokensEmbedded: 0,
      };
      const docs = jobsRef.current
        .filter((j) => j.status === "ready" || j.status === "failed")
        .map<KnowledgeBaseDoc>((j) => ({
          id: j.id,
          projectId,
          name: j.name,
          mimeType: j.file?.type ?? "text/plain",
          byteSize: j.byteSize,
          type: j.type,
          addedAt: new Date().toISOString(),
          status: j.status,
          statusDetail: j.statusDetail,
          chunkCount:
            j.status === "ready" ? (j.pendingChunkBlueprints?.length ?? 0) : 0,
          pageCount: j.pageCount,
          sheetCount: j.sheetCount,
          source: j.file ? "upload" : "paste",
        }));
      const totalChunks = docs.reduce((sum, d) => sum + d.chunkCount, 0);
      updateProject({
        knowledgeBase: {
          docs,
          totalChunks,
          totalTokensEmbedded: existing.totalTokensEmbedded + (newChunks ?? 0),
          lastIngestedAt: new Date().toISOString(),
        },
      });
      // Silence unused params — they exist for forward extensibility.
      void newChunks;
      void job;
    },
    [project, projectId, updateProject],
  );

  const addTokensToTotals = useCallback(
    (tokens: number) => {
      if (!project) return;
      const existing: KnowledgeBaseSummary = project.knowledgeBase ?? {
        docs: [],
        totalChunks: 0,
        totalTokensEmbedded: 0,
      };
      updateProject({
        knowledgeBase: {
          ...existing,
          totalTokensEmbedded: existing.totalTokensEmbedded + tokens,
        },
      });
    },
    [project, updateProject],
  );

  // ── Restore on mount: any non-terminal docs from a prior session ──────

  useEffect(() => {
    if (!project?.knowledgeBase) return;
    if (jobsRef.current.length > 0) return; // hydrate only once per session
    const restored: IntakeJob[] = project.knowledgeBase.docs.map((d) => ({
      id: d.id,
      name: d.name,
      byteSize: d.byteSize,
      type: d.type,
      status:
        d.status === "ready" || d.status === "failed" ? d.status : "failed",
      progress: d.status === "ready" ? 1 : 0,
      statusDetail:
        d.status === "ready" || d.status === "failed"
          ? d.statusDetail
          : "Interrupted — retry",
      pageCount: d.pageCount,
      sheetCount: d.sheetCount,
      recoverable: d.status !== "ready",
    }));
    setJobs(restored);
  }, [project?.knowledgeBase]);

  // ── Public actions ────────────────────────────────────────────────────

  const enqueue = useCallback(
    (input: EnqueueInput) => {
      if (!projectId) return;
      if ("rawText" in input) {
        const text = input.rawText.trim();
        if (!text) return;
        const id = generateId();
        setJobs((prev) => [
          ...prev,
          {
            id,
            name: input.name ?? `Note ${prev.length + 1}`,
            byteSize: text.length,
            type: "rawtext",
            status: "queued",
            progress: 0,
            rawText: text,
            recoverable: true,
          },
        ]);
        return;
      }

      const incoming = input.files;
      const accepted: IntakeJob[] = [];
      const rejected: IntakeJob[] = [];
      const slice = incoming.slice(0, MAX_FILES_PER_DROP);
      for (const file of slice) {
        const detection = detectDocType(file.name, file.type);
        if (!detection.ok) {
          rejected.push({
            id: generateId(),
            name: file.name,
            byteSize: file.size,
            type: "txt",
            status: "failed",
            progress: 0,
            statusDetail: detection.reason,
            recoverable: false,
          });
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push({
            id: generateId(),
            name: file.name,
            byteSize: file.size,
            type: detection.docType,
            status: "failed",
            progress: 0,
            statusDetail: `File too large (${(file.size / 1024 / 1024).toFixed(
              1,
            )} MB). Limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
            recoverable: false,
          });
          continue;
        }
        accepted.push({
          id: generateId(),
          name: file.name,
          byteSize: file.size,
          type: detection.docType,
          status: "queued",
          progress: 0,
          file,
          recoverable: true,
        });
      }

      setJobs((prev) => [...prev, ...accepted, ...rejected]);

      if (incoming.length > MAX_FILES_PER_DROP) {
        const skipped = incoming.length - MAX_FILES_PER_DROP;
        // Add a synthetic failed row so the user can see the skip count.
        setJobs((prev) => [
          ...prev,
          {
            id: generateId(),
            name: `${skipped} more files skipped`,
            byteSize: 0,
            type: "txt",
            status: "failed",
            progress: 0,
            statusDetail: `Limit is ${MAX_FILES_PER_DROP} files per drop. Re-drop the rest.`,
            recoverable: false,
          },
        ]);
      }
    },
    [projectId],
  );

  const cancel = useCallback(
    (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      if (job.embeddingAbort) job.embeddingAbort.abort();
      workerRef.current?.postMessage({ type: "cancel", jobId });
      removeJob(jobId);
      void deleteDoc(jobId);
    },
    [removeJob],
  );

  const remove = useCallback(
    (jobId: string) => {
      removeJob(jobId);
      void deleteDoc(jobId);
    },
    [removeJob],
  );

  const retry = useCallback(
    (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      if (job.pendingChunkBlueprints && job.pendingChunkBlueprints.length > 0) {
        // Already past parse — just retry embedding.
        updateJob(jobId, {
          status: "embedding",
          progress: 0,
          stage: "embedding",
          statusDetail: undefined,
        });
      } else {
        updateJob(jobId, {
          status: "queued",
          progress: 0,
          statusDetail: undefined,
        });
      }
    },
    [updateJob],
  );

  const runOcr = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job || !job.file) {
        toast.error("OCR needs the original file", {
          description: "Re-upload the PDF and try again.",
        });
        return;
      }
      if (job.type !== "pdf") {
        toast.error("OCR only supports PDFs in this version");
        return;
      }
      updateJob(jobId, {
        status: "parsing",
        progress: 0,
        statusDetail: "Running OCR — this may take a few minutes for big PDFs.",
        stage: "parsing",
      });
      try {
        const ocrMod = await import("@/lib/kb/ocr");
        const { chunks, pageCount } = await ocrMod.ocrPdf(job.file, {
          onProgress: (done, total) =>
            updateJob(jobId, {
              progress: done / total,
              statusDetail: `OCR page ${done}/${total}`,
            }),
        });
        if (chunks.length === 0) {
          updateJob(jobId, {
            status: "failed",
            statusDetail: "OCR ran but no text was recognised.",
            recoverable: false,
          });
          return;
        }
        updateJob(jobId, (j) => ({
          ...j,
          status: "embedding",
          progress: 0,
          stage: "embedding",
          pendingChunkBlueprints: chunks,
          pageCount,
          statusDetail: undefined,
        }));
        // Embedding dispatcher picks it up.
      } catch (err) {
        updateJob(jobId, {
          status: "failed",
          statusDetail:
            "OCR failed: " +
            (err instanceof Error ? err.message : "Unknown error"),
          recoverable: true,
        });
      }
    },
    [updateJob],
  );

  // Vision-describe — render PDF pages, get gpt-4o-mini descriptions per
  // page, then funnel descriptions through the chunker + embedder. Useful
  // for slide-heavy or diagram-heavy PDFs that OCR can't read well.
  const runVision = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job || !job.file) {
        toast.error("Vision pass needs the original file", {
          description: "Re-upload the PDF and try again.",
        });
        return;
      }
      if (job.type !== "pdf") {
        toast.error("Vision pass only supports PDFs right now");
        return;
      }
      updateJob(jobId, {
        status: "parsing",
        progress: 0,
        stage: "parsing",
        statusDetail: "Rendering pages for vision pass…",
      });
      try {
        const visionMod = await import("@/lib/kb/vision");
        const { descriptions, pageCount } = await visionMod.describePdfPages(
          job.file,
          {
            onProgress: (done, total) =>
              updateJob(jobId, {
                progress: done / total,
                statusDetail: `Vision page ${done}/${total}`,
              }),
          },
        );
        if (descriptions.length === 0) {
          updateJob(jobId, {
            status: "failed",
            statusDetail: "Vision pass returned no descriptions.",
            recoverable: false,
          });
          return;
        }
        const sources = descriptions.map((d) => ({
          text: d.text,
          page: d.page,
        }));
        const blueprints = chunkSources(sources);
        updateJob(jobId, (j) => ({
          ...j,
          status: "embedding",
          progress: 0,
          stage: "embedding",
          pendingChunkBlueprints: blueprints,
          pageCount,
          statusDetail: undefined,
        }));
      } catch (err) {
        updateJob(jobId, {
          status: "failed",
          statusDetail:
            "Vision pass failed: " +
            (err instanceof Error ? err.message : "Unknown error"),
          recoverable: true,
        });
      }
    },
    [updateJob],
  );

  // Re-chunk + re-embed from edited text. The job stays in place but its
  // chunks are wiped and replaced. Existing source citations pointing at
  // the old chunk IDs will dangle — acceptable cost for the simpler
  // implementation; future-state could re-stamp refs by best-effort match.
  const reprocessFromText = useCallback(
    async (jobId: string, text: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job || !projectId) return;
      const blueprints = chunkText(text);
      if (blueprints.length === 0) {
        toast.error("Nothing to embed — text is empty");
        return;
      }
      // Wipe old chunks first by deleting the doc record (cascades) then
      // re-creating it in IDB once embedding completes.
      try {
        await deleteDoc(jobId);
      } catch {
        /* IDB cleanup is best-effort */
      }
      updateJob(jobId, (j) => ({
        ...j,
        status: "embedding",
        progress: 0,
        stage: "embedding",
        pendingChunkBlueprints: blueprints,
        rawText: text,
        statusDetail: undefined,
      }));
      // Embedding dispatcher picks it up.
    },
    [projectId, updateJob],
  );

  const readText = useCallback(
    async (jobId: string): Promise<string> => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return "";
      if (job.rawText) return job.rawText;
      if (job.pendingChunkBlueprints && job.pendingChunkBlueprints.length > 0) {
        return job.pendingChunkBlueprints.map((c) => c.text).join("\n\n");
      }
      try {
        const chunks = await getProjectChunksWithEmbeddings(projectId);
        return chunks
          .filter((c) => c.docId === jobId)
          .sort((a, b) => a.chunkIndex - b.chunkIndex)
          .map((c) => c.text)
          .join("\n\n");
      } catch {
        return "";
      }
    },
    [projectId],
  );

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const summarise = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      const chunks = job.pendingChunkBlueprints ?? [];
      if (chunks.length === 0) {
        toast.error("Doc has no chunks to summarise");
        return;
      }
      try {
        const res = await fetch("/api/summarize/doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docName: job.name,
            chunks: chunks.slice(0, 8).map((c) => c.text),
          }),
        });
        const data = await res.json();
        if (data.error || !data.summary) {
          toast.error("Couldn't summarise", {
            description: data.message ?? data.error,
          });
          return;
        }
        setSummaries((prev) => ({ ...prev, [jobId]: data.summary }));
        // Persist on the doc metadata via WorkspaceProvider so the
        // summary survives reload.
        if (project?.knowledgeBase) {
          const docs = project.knowledgeBase.docs.map((d) =>
            d.id === jobId ? { ...d, summary: data.summary } : d,
          );
          updateProject({
            knowledgeBase: { ...project.knowledgeBase, docs },
          });
        }
        toast.success(`Summarised: ${job.name}`);
      } catch (err) {
        toast.error("Summarisation failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [project, updateProject],
  );

  // Hydrate existing summaries from project metadata once.
  useEffect(() => {
    if (!project?.knowledgeBase) return;
    const fromMeta: Record<string, string> = {};
    for (const d of project.knowledgeBase.docs) {
      if (d.summary) fromMeta[d.id] = d.summary;
    }
    setSummaries((prev) => ({ ...fromMeta, ...prev }));
  }, [project?.knowledgeBase]);

  const totals = useMemo(() => {
    const ready = jobs.filter((j) => j.status === "ready");
    const chunks = ready.reduce(
      (sum, j) => sum + (j.pendingChunkBlueprints?.length ?? 0),
      0,
    );
    const tokens = ready.reduce(
      (sum, j) =>
        sum +
        (j.pendingChunkBlueprints ?? []).reduce(
          (s, c) => s + approxTokenCount(c.text),
          0,
        ),
      0,
    );
    return { docs: ready.length, chunks, tokens };
  }, [jobs]);

  const parsingCount = jobs.filter(
    (j) => j.status === "parsing" || j.status === "chunking",
  ).length;
  const embeddingCount = jobs.filter((j) => j.status === "embedding").length;
  const hasReadyDocs = jobs.some((j) => j.status === "ready");

  return {
    jobs,
    enqueue,
    cancel,
    retry,
    remove,
    summarise,
    summaries,
    runOcr,
    runVision,
    reprocessFromText,
    readText,
    totals,
    parsingCount,
    embeddingCount,
    hasReadyDocs,
  };
}

// Exported for callers that want to know whether KB-driven generation is
// enabled — e.g. the GenerateButton split-menu.
export function hasReadyKnowledgeBase(
  project: OnboardingProject | null,
): boolean {
  return (project?.knowledgeBase?.totalChunks ?? 0) > 0;
}
