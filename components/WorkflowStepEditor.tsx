"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FormField,
  ChipInput,
  validateRequired,
} from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import { CHIP } from "@/lib/semantic-colors";
import { Surface } from "@/components/ui/surface";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { StarterPackPicker } from "@/components/StarterPackPicker";
import { GenerateFromDiscoveryButton } from "@/components/GenerateFromDiscoveryButton";
import type { WorkflowStep, FutureState, OnboardingProject } from "@/lib/types";

type Props = {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
};

const FUTURE_STATE_LABELS: Record<FutureState, string> = {
  human_led: "Human-Led",
  ai_assisted: "AI-Assisted",
  automated: "Automated",
  requires_approval: "Requires Approval",
};

const FUTURE_STATE_COLORS: Record<FutureState, string> = {
  human_led: CHIP.neutral,
  ai_assisted: CHIP.info,
  automated: CHIP.success,
  requires_approval: CHIP.medium,
};

const AUTO_COLORS: Record<string, string> = {
  high: CHIP.success,
  medium: CHIP.medium,
  low: CHIP.neutral,
};

// Smart defaults from Discovery: ownerTeam from buyerTeam, currentSystem
// from the first non-blocked system already on the project. Reduces repeated
// typing of the same Sponsoring Team across every step.
function newStep(project?: OnboardingProject | null): WorkflowStep {
  const firstUsableSystem = project?.systems.find(
    (s) => s.name && s.apiAvailable !== false,
  );
  return {
    id: generateId(),
    name: "",
    description: "",
    ownerTeam: project?.discovery.buyerTeam ?? "",
    currentSystem: firstUsableSystem?.name ?? "",
    inputData: [],
    outputArtifact: [],
    painPoints: [],
    manualEffort: "medium",
    frequency: "daily",
    failureModes: [],
    automationPotential: "medium",
    futureState: "ai_assisted",
  };
}

type StepRowProps = {
  step: WorkflowStep;
  index: number;
  onUpdate: (patch: Partial<WorkflowStep>) => void;
  onRemove: () => void;
};

function StepRow({ step, index, onUpdate, onRemove }: StepRowProps) {
  const [open, setOpen] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  return (
    <Surface className={cn(open && "ring-1 ring-primary/20")}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {open ? (
            <div className="space-y-1">
              <Input
                value={step.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                onBlur={(e) =>
                  setNameError(validateRequired(e.target.value, "Step name"))
                }
                aria-invalid={!!nameError}
                placeholder="Step name…"
                className="h-7 text-sm font-medium"
              />
              {nameError && (
                <p className="text-[11px] text-destructive" role="alert">
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium truncate">
              {step.name || (
                <span className="text-muted-foreground italic">
                  Unnamed step
                </span>
              )}
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {step.ownerTeam && !open && (
            <span className="text-xs text-muted-foreground">
              {step.ownerTeam}
            </span>
          )}
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              FUTURE_STATE_COLORS[step.futureState],
            )}
          >
            {FUTURE_STATE_LABELS[step.futureState]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              AUTO_COLORS[step.automationPotential],
            )}
          >
            {step.automationPotential} auto
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            {open ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-destructive/70 hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {/* Expanded edit panel */}
      {open && (
        <>
          <Separator />
          <div className="px-4 py-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="Owner Team" helper="Who runs this step today.">
                <Input
                  value={step.ownerTeam}
                  onChange={(e) => onUpdate({ ownerTeam: e.target.value })}
                  placeholder="AML Analysts"
                />
              </FormField>
              <FormField
                label="Current System"
                helper="The tool used at this step."
              >
                <Input
                  value={step.currentSystem}
                  onChange={(e) => onUpdate({ currentSystem: e.target.value })}
                  placeholder="Actimize Case Manager"
                />
              </FormField>
            </div>

            <FormField
              label="Description"
              helper="What actually happens. 1-2 sentences."
            >
              <Textarea
                rows={2}
                value={step.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Analyst opens the case, reviews alert details, and decides whether to investigate or close."
              />
            </FormField>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                label="Pain Points"
                helper="Frustrations, delays, manual rework."
              >
                <ChipInput
                  value={step.painPoints}
                  onChange={(v) => onUpdate({ painPoints: v })}
                  placeholder="e.g. context switching"
                  ariaLabel="Pain points"
                />
              </FormField>
              <FormField
                label="Failure Modes"
                helper="What can go wrong at this step."
              >
                <ChipInput
                  value={step.failureModes}
                  onChange={(v) => onUpdate({ failureModes: v })}
                  placeholder="e.g. missed escalation"
                  ariaLabel="Failure modes"
                />
              </FormField>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                label="Manual Effort"
                helper="How much human time per occurrence."
              >
                <Select
                  value={step.manualEffort}
                  onValueChange={(v) =>
                    onUpdate({
                      manualEffort: v as WorkflowStep["manualEffort"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Frequency" helper="How often this step runs.">
                <Select
                  value={step.frequency}
                  onValueChange={(v) =>
                    onUpdate({ frequency: v as WorkflowStep["frequency"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="ad_hoc">Ad-hoc</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Automation Potential"
                helper="How well-suited to AI assistance."
              >
                <Select
                  value={step.automationPotential}
                  onValueChange={(v) =>
                    onUpdate({
                      automationPotential:
                        v as WorkflowStep["automationPotential"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Future State"
                helper="Target role in the AI-enabled workflow."
              >
                <Select
                  value={step.futureState}
                  onValueChange={(v) =>
                    onUpdate({ futureState: v as FutureState })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="human_led">Human-Led</SelectItem>
                    <SelectItem value="ai_assisted">AI-Assisted</SelectItem>
                    <SelectItem value="automated">Automated</SelectItem>
                    <SelectItem value="requires_approval">
                      Requires Approval
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}

export function WorkflowStepEditor({ steps, onChange }: Props) {
  const { project } = useWorkspace();
  const updateStep = (id: string, patch: Partial<WorkflowStep>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  const addStep = () => {
    onChange([...steps, newStep(project)]);
  };

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <EmptyState
          icon="🛠"
          title="No workflow steps yet"
          body="Outline each step your customer uses today — who owns it, what system they use, and what slows them down. This powers the workflow visualisation."
          cta={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={addStep}
                className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
              >
                + Add first step
              </button>
              <GenerateFromDiscoveryButton target="workflows" />
              <StarterPackPicker
                target="workflows"
                label="Add a workflow pack"
              />
            </div>
          }
        />
      )}
      {steps.map((step, i) => (
        <StepRow
          key={step.id}
          step={step}
          index={i}
          onUpdate={(patch) => updateStep(step.id, patch)}
          onRemove={() => removeStep(step.id)}
        />
      ))}
      <button
        type="button"
        onClick={addStep}
        className="w-full rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors"
      >
        + Add workflow step
      </button>
    </div>
  );
}
