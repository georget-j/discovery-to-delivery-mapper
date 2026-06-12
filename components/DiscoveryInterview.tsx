"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Surface } from "@/components/ui/surface";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { applySuggestionsToProject } from "@/lib/apply-suggestions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { INTERVIEW_OPENING } from "@/lib/prompts/discovery-interview";
import type { NotesExtractionResult } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  // Optional inline confirmation of what was captured this turn.
  captured?: string;
};

type Props = {
  onComplete?: () => void;
};

const transcriptKey = (projectId: string) =>
  `dtdm:discovery-transcript:${projectId}`;

const INTRO_MESSAGE: ChatMessage = {
  id: "intro",
  role: "assistant",
  content: INTERVIEW_OPENING,
};

// The transcript must survive view toggles and navigation mid-call, so it
// lives in sessionStorage keyed by project id rather than component state.
function restoreTranscript(projectId: string | undefined): ChatMessage[] {
  if (!projectId || typeof window === "undefined") return [INTRO_MESSAGE];
  try {
    const raw = sessionStorage.getItem(transcriptKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupt entry — start a fresh transcript.
  }
  return [INTRO_MESSAGE];
}

// Conversational alternative to the form-based Discovery flow. Asks one
// question at a time, parses each reply into a structured patch, and
// auto-applies it to the project. The form view remains togglable from
// the page; switching to it shows everything the chat captured.
export function DiscoveryInterview({ onComplete }: Props) {
  const { project, updateProject } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    restoreTranscript(project?.id),
  );
  // Mirrors `messages` synchronously — a queued send fires from the previous
  // turn's finally block, before React re-renders, so the state closure is
  // stale at that point.
  const messagesRef = useRef<ChatMessage[]>(messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  // One-slot queue for replies submitted while a turn is in flight.
  const [queued, setQueued] = useState<string | null>(null);
  const queuedRef = useRef<string | null>(null);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const appendMessages = (next: ChatMessage[]) => {
    messagesRef.current = [...messagesRef.current, ...next];
    setMessages(messagesRef.current);
  };

  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) return;
    sessionStorage.setItem(transcriptKey(projectId), JSON.stringify(messages));
  }, [messages, projectId]);

  // A restored transcript may already have reached the wrap-up message.
  useEffect(() => {
    if (messagesRef.current.some((m) => m.id.startsWith("done-")))
      setDone(true);
  }, []);

  // Auto-scroll on new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, queued]);

  if (!project) return null;

  // Convert "all picked" so applySuggestionsToProject merges everything.
  const applyAll = (extracted: NotesExtractionResult) => {
    const picks = new Set<string>();
    if (extracted.discovery)
      Object.keys(extracted.discovery).forEach((k) =>
        picks.add(`discovery:${k}`),
      );
    extracted.suggestedStakeholders?.forEach((_, i) =>
      picks.add(`stakeholder:${i}`),
    );
    extracted.suggestedSystems?.forEach((_, i) => picks.add(`system:${i}`));
    extracted.suggestedDataSources?.forEach((_, i) =>
      picks.add(`dataSource:${i}`),
    );
    extracted.suggestedWorkflows?.forEach((_, i) => picks.add(`workflow:${i}`));
    extracted.suggestedRisks?.forEach((_, i) => picks.add(`risk:${i}`));
    const { patch, appliedLabels } = applySuggestionsToProject(
      project,
      extracted,
      picks as Set<never>,
    );
    if (Object.keys(patch).length > 0) {
      updateProject(patch);
    }
    return appliedLabels;
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    if (!text) return;
    if (sendingRef.current) {
      // Queue instead of dropping — the input stays live while a turn is in
      // flight, and the held reply dispatches when the turn resolves.
      queuedRef.current = queuedRef.current
        ? `${queuedRef.current}\n${text}`
        : text;
      setQueued(queuedRef.current);
      if (overrideText === undefined) setDraft("");
      return;
    }
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    appendMessages([userMsg]);
    const nextHistory = messagesRef.current;
    if (overrideText === undefined) setDraft("");
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await fetch("/api/discovery/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          history: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (data.error === "no_api_key") {
        toast.error(
          "Interview mode needs an OPENAI_API_KEY — switch to Form view to fill manually.",
        );
        return;
      }
      if (data.error) {
        toast.error("Chat failed", {
          description:
            typeof data.message === "string" ? data.message : data.error,
        });
        return;
      }
      let capturedLabel: string | undefined;
      if (data.extracted) {
        const labels = applyAll(data.extracted as NotesExtractionResult);
        if (labels.length > 0) {
          capturedLabel = `Saved: ${labels.slice(0, 3).join(" · ")}`;
        }
      }
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        captured: capturedLabel,
      };
      const followUp = data.nextQuestion;
      const newMessages: ChatMessage[] = [reply];
      if (followUp) {
        newMessages.push({
          id: `aq-${Date.now()}`,
          role: "assistant",
          content: followUp,
        });
      } else {
        newMessages.push({
          id: `done-${Date.now()}`,
          role: "assistant",
          content:
            "That's enough to start. Switch to Form view to refine, or jump to the next phase from the sidebar.",
        });
        setDone(true);
      }
      appendMessages(newMessages);
    } catch (err) {
      toast.error("Network error", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
      const held = queuedRef.current;
      queuedRef.current = null;
      setQueued(null);
      if (held) void send(held);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100dvh-12rem)]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 px-1 pb-3"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <Surface
              variant={m.role === "user" ? "default" : "muted"}
              className={cn(
                "max-w-[85%] px-3 py-2 text-sm leading-relaxed",
                m.role === "user" && "bg-primary/5 border-primary/20",
              )}
            >
              <p>{m.content}</p>
              {m.captured && (
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  ✓ {m.captured}
                </p>
              )}
            </Surface>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <Surface
              variant="muted"
              className="px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
                Thinking…
              </span>
            </Surface>
          </div>
        )}
        {queued && (
          <div className="flex justify-end">
            <Surface
              variant="default"
              className="max-w-[85%] px-3 py-2 text-sm leading-relaxed bg-primary/5 border-primary/20 opacity-70"
            >
              <p>{queued}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Queued — sends when the current turn finishes
              </p>
            </Surface>
          </div>
        )}
      </div>
      {done && onComplete && (
        <div className="pb-2">
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-primary hover:underline"
          >
            Switch to Form view →
          </button>
        </div>
      )}
      <div className="border-t pt-3 space-y-2">
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type your answer, or press the mic to speak…"
        />
        <div className="flex items-center justify-between gap-2">
          <VoiceInputButton
            label="Speak"
            onTranscript={(text) =>
              setDraft((prev) => (prev ? `${prev} ${text}` : text))
            }
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim()}
            className="text-xs px-4 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {sending ? (draft.trim() ? "Queue ↵" : "Sending…") : "Send ↵"}
          </button>
        </div>
      </div>
    </div>
  );
}
