"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { generateId } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Sheet } from "@/components/ui/sheet";
import { PATTERN_FAMILY_COLOR } from "@/lib/patterns/future-state-patterns";
import { cn } from "@/lib/utils";
import type {
  AutomationPatternFamily,
  CustomAutomationPattern,
  FutureState,
} from "@/lib/types";

const FAMILIES: AutomationPatternFamily[] = [
  "agent",
  "agent_with_validator",
  "multi_agent",
  "rag",
  "rules_plus_ai",
  "hitl",
  "continuous_learning",
  "copilot",
];

const FUTURE_STATES: FutureState[] = [
  "human_led",
  "ai_assisted",
  "automated",
  "requires_approval",
];

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

// Lets the user add org-specific patterns (e.g. "Our CX Triage Pattern") that
// the recommender will include alongside the built-in catalogue. Stored on
// project.customPatterns so each onboarding can curate its own playbook.
export function CustomPatternEditor({ open, onOpenChange }: Props) {
  const { project, updateProject } = useWorkspace();
  const [draft, setDraft] = useState<CustomAutomationPattern>(() => blank());

  if (!project) return null;
  const patterns = project.customPatterns ?? [];

  const reset = () => setDraft(blank());

  const save = () => {
    if (!draft.name.trim()) {
      toast.info("Name the pattern first");
      return;
    }
    const next: CustomAutomationPattern = {
      ...draft,
      id:
        draft.id ||
        `custom-${
          draft.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 32) || generateId()
        }`,
      createdAt: new Date().toISOString(),
      whenToUse: draft.whenToUse.filter(Boolean),
    };
    updateProject({
      customPatterns: [...patterns.filter((p) => p.id !== next.id), next],
    });
    toast.success(`Saved pattern: ${next.name}`);
    reset();
  };

  const removeAt = (id: string) => {
    updateProject({ customPatterns: patterns.filter((p) => p.id !== id) });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      ariaLabel="Custom pattern catalogue"
      className="!w-[min(32rem,90vw)]"
    >
      <div className="p-4 space-y-5">
        <div>
          <p className="text-sm font-semibold">Custom pattern catalogue</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add proprietary or org-specific patterns. They&apos;ll be passed to
            the recommender alongside the built-in catalogue.
          </p>
        </div>

        {patterns.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Saved patterns
            </p>
            {patterns.map((p) => (
              <div
                key={p.id}
                className="rounded border p-2 flex items-start gap-2"
              >
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0",
                    PATTERN_FAMILY_COLOR[p.family],
                  )}
                >
                  {p.family.replace(/_/g, " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {p.shortDescription}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(p.id)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Add a pattern
          </p>
          <Field label="Name">
            <input
              type="text"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="e.g. CX Triage with Slack handoff"
              className="w-full text-sm px-2 py-1 rounded border bg-background"
            />
          </Field>
          <Field label="Family">
            <select
              value={draft.family}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  family: e.target.value as AutomationPatternFamily,
                }))
              }
              className="w-full text-sm px-2 py-1 rounded border bg-background"
            >
              {FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Short description">
            <textarea
              rows={2}
              value={draft.shortDescription}
              onChange={(e) =>
                setDraft((d) => ({ ...d, shortDescription: e.target.value }))
              }
              placeholder="One sentence about what this pattern does."
              className="w-full text-sm px-2 py-1 rounded border bg-background"
            />
          </Field>
          <Field label="When to use (one per line)">
            <textarea
              rows={3}
              value={draft.whenToUse.join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  whenToUse: e.target.value.split(/\n/),
                }))
              }
              placeholder="High-volume CX inbound\nClear deflection criteria"
              className="w-full text-sm px-2 py-1 rounded border bg-background"
            />
          </Field>
          <Field label="Architecture (paragraph)">
            <textarea
              rows={3}
              value={draft.exampleArchitecture}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  exampleArchitecture: e.target.value,
                }))
              }
              placeholder="Inbound message → triage agent classifies intent..."
              className="w-full text-sm px-2 py-1 rounded border bg-background"
            />
          </Field>
          <Field label="Future-state enum">
            <select
              value={draft.recommendedFutureState}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  recommendedFutureState: e.target.value as FutureState,
                }))
              }
              className="w-full text-sm px-2 py-1 rounded border bg-background"
            >
              {FUTURE_STATES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="text-xs px-3 py-1.5 rounded border hover:bg-muted/30"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              className="text-xs px-3 py-1.5 rounded bg-foreground text-background hover:bg-foreground/90 font-medium"
            >
              Save pattern
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium">{label}</span>
      {children}
    </label>
  );
}

function blank(): CustomAutomationPattern {
  return {
    id: "",
    family: "agent",
    name: "",
    shortDescription: "",
    whenToUse: [],
    exampleArchitecture: "",
    recommendedFutureState: "ai_assisted",
    createdAt: "",
  };
}
