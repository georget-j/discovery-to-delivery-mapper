"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sheet } from "@/components/ui/sheet";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Turn = { role: "user" | "assistant"; content: string };

// Right-side chat panel that talks to /api/copilot. Carries the current
// project state as grounding; cites stakeholder/system IDs in the form [id]
// which we render as small inline chips. Keyboard: Cmd/Ctrl+Shift+K toggles.
export function ProjectCopilot() {
  const { project } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, busy]);

  const send = useCallback(async () => {
    if (!project || !draft.trim() || busy) return;
    const message = draft.trim();
    setDraft("");
    setBusy(true);
    setHistory((h) => [...h, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, message, history }),
      });
      const data = await res.json();
      if (data.error === "no_api_key") {
        toast.info("Copilot needs an OpenAI API key set on the server.");
        setHistory((h) => [
          ...h,
          {
            role: "assistant",
            content:
              "I can't reply right now — the server has no OpenAI API key set. Set OPENAI_API_KEY and try again.",
          },
        ]);
        return;
      }
      if (data.error) {
        const detail =
          typeof data.message === "string" ? data.message : data.error;
        toast.error("Copilot turn failed", { description: detail });
        setHistory((h) => [
          ...h,
          { role: "assistant", content: `Sorry — ${detail}` },
        ]);
        return;
      }
      setHistory((h) => [...h, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      toast.error("Copilot turn failed", { description: detail });
      setHistory((h) => [
        ...h,
        { role: "assistant", content: `Sorry — ${detail}` },
      ]);
    } finally {
      setBusy(false);
    }
  }, [project, draft, history, busy]);

  const reset = () => setHistory([]);

  if (!project) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/90 transition-colors hidden md:flex items-center justify-center text-lg"
        aria-label="Open project copilot"
        title="Open copilot (Cmd+Shift+K)"
      >
        💬
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        ariaLabel="Project copilot"
      >
        <div className="flex flex-col h-full w-full md:w-96 bg-background border-l shadow-xl">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Project Copilot</p>
              <p className="text-[11px] text-muted-foreground">
                Grounded in {project.customer.companyName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Close copilot"
              >
                ✕
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 && (
              <div className="text-xs text-muted-foreground space-y-3 mt-4">
                <p>
                  Ask anything about this onboarding project. The copilot reads
                  your full project state and cites the entities it references.
                </p>
                <p className="font-medium text-foreground">Try:</p>
                <ul className="space-y-1.5">
                  <SuggestionRow
                    text="What's blocking the pilot right now?"
                    onClick={() =>
                      setDraft("What's blocking the pilot right now?")
                    }
                  />
                  <SuggestionRow
                    text="Which systems are highest integration risk?"
                    onClick={() =>
                      setDraft("Which systems are highest integration risk?")
                    }
                  />
                  <SuggestionRow
                    text="Who haven't I named as a stakeholder yet?"
                    onClick={() =>
                      setDraft("Who haven't I named as a stakeholder yet?")
                    }
                  />
                  <SuggestionRow
                    text="Summarise the pilot success criteria in one paragraph."
                    onClick={() =>
                      setDraft(
                        "Summarise the pilot success criteria in one paragraph.",
                      )
                    }
                  />
                </ul>
              </div>
            )}
            {history.map((t, i) => (
              <Bubble key={i} turn={t} />
            ))}
            {busy && (
              <div className="text-[11px] text-muted-foreground italic">
                Copilot is thinking…
              </div>
            )}
          </div>

          <footer className="border-t p-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask the copilot…  (Enter to send · Shift+Enter for newline)"
              rows={2}
              className="flex-1 text-sm rounded-md border bg-background px-2.5 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              disabled={busy}
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !draft.trim()}
              className={cn(
                "text-xs px-3 py-2 rounded-md font-medium transition-colors",
                busy || !draft.trim()
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              Send
            </button>
          </footer>
        </div>
      </Sheet>
    </>
  );
}

function SuggestionRow({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="text-left text-xs px-2 py-1.5 rounded-md border border-border w-full hover:bg-muted/50 transition-colors"
      >
        {text}
      </button>
    </li>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-sm leading-relaxed",
        isUser ? "bg-muted/50 ml-6" : "bg-background border mr-6",
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap">{turn.content}</p>
      ) : (
        <p className="whitespace-pre-wrap">{renderWithChips(turn.content)}</p>
      )}
    </div>
  );
}

function renderWithChips(content: string) {
  // Render [id] tokens as monospace inline chips.
  const parts: (string | { id: string })[] = [];
  const re = /\[([a-zA-Z0-9_-]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index));
    parts.push({ id: m[1] });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <code
        key={i}
        className="px-1 py-0.5 mx-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px]"
      >
        {p.id}
      </code>
    ),
  );
}
