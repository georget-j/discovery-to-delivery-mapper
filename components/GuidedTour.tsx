"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { loadScenario } from "@/lib/scenarios";

const STORAGE_KEY = "ux:tourV1Completed";

// Dispatched (window-level) by the Command Palette's "Replay guided tour"
// entry — the tour restarts from step 0 regardless of completion state.
export const TOUR_REPLAY_EVENT = "ux:tour:replay";

type Step = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref?: (projectId: string) => string;
  ctaAction?: "next" | "close";
};

// Phase walkthrough shared by both tour variants.
const PHASE_STEPS: Step[] = [
  {
    title: "1. Capture what you learned",
    body: "Discovery holds the customer profile, business problem, and stakeholders. Use the chat interview or the form — and paste meeting notes to have the AI extract structured suggestions you review row by row.",
    ctaLabel: "Open Discovery",
    ctaHref: (id) => `/workspace/${id}/discovery`,
    ctaAction: "next",
  },
  {
    title: "2. Map the system",
    body: "Design covers workflows, customer systems, and requirements. Auto-generation flags risks (no API, blocked access, poor quality data) as you fill these in — click the (i) on any risk to see why.",
    ctaLabel: "Open Workflow",
    ctaHref: (id) => `/workspace/${id}/workflow`,
    ctaAction: "next",
  },
  {
    title: "3. De-risk and pilot",
    body: "Plan turns the design into a risk register and a pilot. Success metrics, launch criteria, rollback gates — everything a customer needs to say yes.",
    ctaLabel: "Open Pilot Plan",
    ctaHref: (id) => `/workspace/${id}/pilot`,
    ctaAction: "next",
  },
];

// Blank projects have nothing to show yet — the tour points at Intake first.
const BLANK_STEPS: Step[] = [
  {
    title: "Welcome — let's walk the journey",
    body: "This tool maps customer discovery into a deployable plan. Start by dropping documents on Intake, then walk 4 phases. Press Cmd+K any time to jump around.",
    ctaLabel: "Show me Intake",
    ctaAction: "next",
  },
  {
    title: "Start: drop your documents",
    body: "Intake takes any customer docs — PDFs, Word, Excel, raw notes. The tool builds a knowledge base and pre-fills Discovery, workflows, systems, stakeholders, and risks for you to review. No docs? Skip it and fill manually.",
    ctaLabel: "Open Intake",
    ctaHref: (id) => `/workspace/${id}/intake`,
    ctaAction: "next",
  },
  ...PHASE_STEPS,
  {
    title: "4. Generate the deployment pack",
    body: "Outputs assembles 15 customer-facing + internal artifacts (Exec summary, Comms plan, Engineering handoff…). Click Generate, then Export to ship.",
    ctaLabel: "Got it",
    ctaAction: "close",
  },
];

// Seeded demos arrive pre-filled — skip Intake and land the user on
// Outputs → Generate, the fastest payoff.
const SEEDED_STEPS: Step[] = [
  {
    title: "Welcome — this demo is pre-filled",
    body: "This scenario ships with discovery, workflows, systems, and risks already captured. Walk the 4 phases to see how it fits together, then generate the deployment pack. Press Cmd+K any time to jump around.",
    ctaLabel: "Show me around",
    ctaAction: "next",
  },
  ...PHASE_STEPS,
  {
    title: "4. Generate the deployment pack",
    body: "Outputs assembles 15 customer-facing + internal artifacts (Exec summary, Comms plan, Engineering handoff…). Click Generate, then Export to ship.",
    ctaLabel: "Open Outputs",
    ctaHref: (id) => `/workspace/${id}/outputs`,
    ctaAction: "close",
  },
];

type Props = { projectId: string };

// Multi-step tour shown on first visit to any workspace. Persists completion
// in localStorage; user can re-trigger via the Command Palette's "Replay
// guided tour". Renders nothing while the workspace is loading or missing so
// it never floats over an error state.
export function GuidedTour({ projectId }: Props) {
  const { project, loading } = useWorkspace();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
    setStep(0);
  }, []);

  useEffect(() => {
    const onReplay = () => setStep(0);
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  if (loading || !project || step === null) return null;

  const steps = loadScenario(projectId) ? SEEDED_STEPS : BLANK_STEPS;
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    setStep(null);
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => (s === null ? 0 : s + 1));
  };

  const dots = (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Step ${step + 1} of ${steps.length}`}
    >
      {steps.map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={
            "w-1.5 h-1.5 rounded-full transition-colors " +
            (i === step
              ? "bg-foreground"
              : i < step
                ? "bg-foreground/40"
                : "bg-muted-foreground/20")
          }
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 z-40 pointer-events-none">
      <div className="pointer-events-auto mx-auto sm:mx-0 w-full sm:w-96 rounded-t-lg sm:rounded-lg bg-background border-2 border-primary/40 shadow-xl pb-safe">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">{current.title}</p>
            <button
              type="button"
              onClick={finish}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Skip the tour"
            >
              Skip
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {current.body}
          </p>
          <div className="flex items-center justify-between pt-1">
            {dots}
            <div className="flex items-center gap-1.5">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setStep((s) => (s === null ? 0 : Math.max(0, s - 1)))
                  }
                  className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted/50 transition-colors"
                >
                  Back
                </button>
              )}
              {current.ctaHref ? (
                <Link
                  href={current.ctaHref(projectId)}
                  onClick={() => {
                    if (current.ctaAction === "close") finish();
                    else next();
                  }}
                  className="text-xs px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
                >
                  {current.ctaLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="text-xs px-3 py-1 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
                >
                  {current.ctaLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
