"use client";

import { useState } from "react";
import { VoiceInputButton } from "@/components/ui/voice-input-button";

type Props = {
  onSubmit: (text: string, name?: string) => void;
};

// Collapsible "paste raw notes" surface so the dropzone stays the hero.
// Reuses the voice-input button so dictation lands here too.
export function PasteNoteInput({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed, name.trim() || undefined);
    setText("");
    setName("");
  };

  return (
    <div className="rounded-md border bg-muted/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/20 transition-colors"
      >
        <span className="font-medium">📝 Paste raw notes</span>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional name (e.g. 'Kickoff call notes')"
            className="w-full px-2 py-1 text-sm rounded border bg-background"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste call notes, customer email, internal scoping doc, anything…"
            className="w-full px-2 py-1.5 text-sm rounded border bg-background resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <VoiceInputButton
              label="Dictate"
              onTranscript={(t) =>
                setText((prev) => (prev ? `${prev} ${t}` : t))
              }
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="text-xs px-3 py-1.5 rounded bg-foreground text-background disabled:opacity-40"
            >
              Add as note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
