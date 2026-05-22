"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";

type Props = {
  open: boolean;
  jobId: string | null;
  jobName: string | null;
  onLoad: (jobId: string) => Promise<string>;
  onSave: (jobId: string, text: string) => Promise<void>;
  onClose: () => void;
};

// Lets the user inspect and edit the raw extracted text of a doc, then
// re-chunk + re-embed by saving. Useful when OCR or auto-extraction produces
// garbled output that's better fixed by hand than re-uploaded.
export function DocEditSheet({
  open,
  jobId,
  jobName,
  onLoad,
  onSave,
  onClose,
}: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open || !jobId) return;
    setLoading(true);
    setDirty(false);
    onLoad(jobId)
      .then((t) => setText(t))
      .finally(() => setLoading(false));
  }, [open, jobId, onLoad]);

  const handleSave = async () => {
    if (!jobId) return;
    setSaving(true);
    try {
      await onSave(jobId, text);
      setDirty(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      side="right"
      ariaLabel="View and edit document text"
      className="!w-[min(40rem,92vw)]"
    >
      <div className="p-4 space-y-3 h-full flex flex-col">
        <div>
          <p className="text-sm font-semibold">{jobName ?? "Document"}</p>
          <p className="text-[11px] text-muted-foreground">
            Edit the extracted text below. Saving re-chunks and re-embeds the
            doc — existing source citations to old chunks may dangle.
          </p>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading text…</p>
        ) : (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            className="flex-1 w-full text-xs font-mono px-3 py-2 rounded border bg-background leading-relaxed resize-none"
            spellCheck={false}
          />
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded border hover:bg-muted/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || loading}
            className="text-xs px-3 py-1.5 rounded bg-foreground text-background hover:bg-foreground/90 font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & re-embed"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
