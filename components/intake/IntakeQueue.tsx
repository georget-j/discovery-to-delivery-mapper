"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR } from "@/components/intake/FileDropzone";
import type { IntakeJob } from "@/components/intake/useIntakeQueue";

type Props = {
  jobs: IntakeJob[];
  onCancel: (jobId: string) => void;
  // Passing a file re-associates it with the doc row (post-reload
  // "Re-upload") before re-queueing.
  onRetry: (jobId: string, file?: File) => void;
  onRemove: (jobId: string) => void;
  onSummarise?: (jobId: string) => void;
  onRunOcr?: (jobId: string) => void;
  onRunVision?: (jobId: string) => void;
  onEdit?: (jobId: string, jobName: string) => void;
  summaries?: Record<string, string>;
};

const STATUS_ICON: Record<IntakeJob["status"], string> = {
  queued: "◯",
  parsing: "⟳",
  chunking: "⟳",
  embedding: "⟳",
  ready: "✓",
  failed: "⚠",
};

const STATUS_COLOR: Record<IntakeJob["status"], string> = {
  queued: "text-muted-foreground",
  parsing: "text-blue-600",
  chunking: "text-blue-600",
  embedding: "text-violet-600",
  ready: "text-emerald-600",
  failed: "text-amber-700",
};

export function IntakeQueue({
  jobs,
  onCancel,
  onRetry,
  onRemove,
  onSummarise,
  onRunOcr,
  onRunVision,
  onEdit,
  summaries,
}: Props) {
  if (jobs.length === 0) return null;
  return (
    <ul className="divide-y rounded-md border bg-background">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span
            className={cn(
              "font-mono w-5 text-center",
              STATUS_COLOR[job.status],
            )}
            aria-hidden
          >
            {STATUS_ICON[job.status]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate" title={job.name}>
                {job.name}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatSize(job.byteSize)}
              </span>
            </div>
            {job.status !== "ready" && job.status !== "failed" && (
              <ProgressBar value={job.progress} label={describeStage(job)} />
            )}
            {job.statusDetail && (
              <p
                className={cn(
                  "text-xs mt-0.5",
                  job.status === "failed"
                    ? "text-amber-700"
                    : "text-muted-foreground",
                )}
              >
                {job.statusDetail}
              </p>
            )}
            {job.warning && (
              <p className="text-xs mt-0.5 text-amber-700">{job.warning}</p>
            )}
            {job.status === "ready" && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {summarizeReady(job)}
              </p>
            )}
            {job.status === "ready" && summaries?.[job.id] && (
              <p className="text-[11px] text-foreground/80 mt-1 italic leading-relaxed">
                {summaries[job.id]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {job.status === "failed" &&
              job.recoverable &&
              (needsReupload(job) ? (
                <ReuploadButton onPick={(file) => onRetry(job.id, file)} />
              ) : (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  className="text-xs px-2 py-1 rounded border hover:bg-muted/40"
                >
                  Retry
                </button>
              ))}
            {job.status === "failed" &&
              onRunOcr &&
              job.type === "pdf" &&
              /scanned|image/i.test(job.statusDetail ?? "") && (
                <button
                  type="button"
                  onClick={() => onRunOcr(job.id)}
                  className="text-xs px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                  title="Run on-device OCR — slow but works on scanned PDFs"
                >
                  Run OCR
                </button>
              )}
            {job.status === "failed" &&
              onRunVision &&
              job.type === "pdf" &&
              /scanned|image|empty/i.test(job.statusDetail ?? "") && (
                <button
                  type="button"
                  onClick={() => onRunVision(job.id)}
                  className="text-xs px-2 py-1 rounded border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900"
                  title="Use gpt-4o-mini vision to describe each page — good for slide-heavy / diagram-heavy PDFs"
                >
                  Describe images
                </button>
              )}
            {(job.status === "queued" ||
              job.status === "parsing" ||
              job.status === "chunking" ||
              job.status === "embedding") && (
              <button
                type="button"
                onClick={() => onCancel(job.id)}
                className="text-xs px-2 py-1 rounded border hover:bg-muted/40"
              >
                Cancel
              </button>
            )}
            {job.status === "ready" && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(job.id, job.name)}
                className="text-xs px-2 py-1 rounded border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                title="View / edit extracted text and re-embed"
              >
                Edit text
              </button>
            )}
            {job.status === "ready" && onSummarise && !summaries?.[job.id] && (
              <button
                type="button"
                onClick={() => onSummarise(job.id)}
                className="text-xs px-2 py-1 rounded border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                title="Generate a one-paragraph summary"
              >
                Summarise
              </button>
            )}
            {(job.status === "ready" || job.status === "failed") && (
              <button
                type="button"
                onClick={() => onRemove(job.id)}
                className="text-xs px-2 py-1 rounded hover:bg-muted/40 text-muted-foreground"
                title="Remove from knowledge base"
              >
                ×
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div className="mt-1">
      <div className="h-1 w-full rounded bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {label} · {pct}%
      </p>
    </div>
  );
}

// After a reload the original File bytes are gone — a blind Retry would be
// guaranteed to fail, so those rows get a re-upload picker instead.
function needsReupload(job: IntakeJob): boolean {
  return (
    !job.file &&
    job.rawText === undefined &&
    (job.pendingChunkBlueprints?.length ?? 0) === 0
  );
}

function ReuploadButton({ onPick }: { onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-xs px-2 py-1 rounded border hover:bg-muted/40"
        title="The original file isn't stored after a reload — pick it again to finish processing"
      >
        Re-upload
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          // Reset so picking the same file again re-fires onChange.
          e.target.value = "";
        }}
      />
    </>
  );
}

function describeStage(job: IntakeJob): string {
  if (job.status === "queued") return "Waiting";
  if (job.status === "parsing") return "Parsing";
  if (job.status === "chunking") return "Chunking";
  if (job.status === "embedding") return "Embedding";
  return job.status;
}

function summarizeReady(job: IntakeJob): string {
  const parts: string[] = [];
  if (job.pageCount) parts.push(`${job.pageCount} pages`);
  if (job.sheetCount)
    parts.push(`${job.sheetCount} sheet${job.sheetCount !== 1 ? "s" : ""}`);
  const chunkCount = job.pendingChunkBlueprints?.length ?? 0;
  if (chunkCount > 0)
    parts.push(`${chunkCount} chunk${chunkCount !== 1 ? "s" : ""}`);
  return parts.join(" · ") || "Ready";
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
