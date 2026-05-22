"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  FormField,
  ChipInput,
  validateMinLength,
} from "@/components/ui/form-field";
import { Surface } from "@/components/ui/surface";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { generateId } from "@/lib/utils";
import type { PilotPlan, SuccessMetric, OnboardingProject } from "@/lib/types";

type Props = {
  plan: PilotPlan | null;
  workflowNames: string[];
  onChange: (plan: PilotPlan) => void;
};

// Smart defaults from Discovery: pre-seed the objective sentence using
// primaryUseCase + desiredOutcome when both are present. Users can rewrite
// freely; the seed just kills the blank-page problem.
function blankPlan(
  workflowNames: string[],
  project?: OnboardingProject | null,
): PilotPlan {
  const useCase = project?.customer.primaryUseCase?.trim();
  const outcome = project?.customer.desiredOutcome?.trim();
  const seededObjective =
    useCase && outcome
      ? `Validate that AI ${useCase} achieves: ${outcome}`
      : "";
  return {
    objective: seededObjective,
    scope: "",
    pilotUsers: [],
    includedWorkflows: workflowNames,
    excludedWorkflows: [],
    durationWeeks: 8,
    successMetrics: [],
    launchCriteria: [],
    rollbackCriteria: [],
    baselineMeasurement: "",
    targetOutcome: outcome ?? "",
  };
}

function blankMetric(): SuccessMetric {
  return {
    id: generateId(),
    name: "",
    baseline: "",
    target: "",
    measurementMethod: "",
    owner: "",
  };
}

type MetricRowProps = {
  metric: SuccessMetric;
  onUpdate: (patch: Partial<SuccessMetric>) => void;
  onRemove: () => void;
};

function MetricRow({ metric, onUpdate, onRemove }: MetricRowProps) {
  return (
    <Surface className="px-4 py-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Metric Name</Label>
          <Input
            value={metric.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="e.g. SAR filing time"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Owner</Label>
          <Input
            value={metric.owner}
            onChange={(e) => onUpdate({ owner: e.target.value })}
            placeholder="e.g. Compliance team"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Baseline</Label>
          <Input
            value={metric.baseline}
            onChange={(e) => onUpdate({ baseline: e.target.value })}
            placeholder="e.g. 4 hours per filing"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target</Label>
          <Input
            value={metric.target}
            onChange={(e) => onUpdate({ target: e.target.value })}
            placeholder="e.g. <45 minutes"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Measurement Method</Label>
          <Input
            value={metric.measurementMethod}
            onChange={(e) => onUpdate({ measurementMethod: e.target.value })}
            placeholder="e.g. Average ticket duration in Jira"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-destructive/70 hover:text-destructive transition-colors"
      >
        Remove metric
      </button>
    </Surface>
  );
}

export function PilotPlanBuilder({ plan, workflowNames, onChange }: Props) {
  const { project } = useWorkspace();
  const p = plan ?? blankPlan(workflowNames, project);
  const [objectiveError, setObjectiveError] = useState<string | undefined>();

  const set = (patch: Partial<PilotPlan>) => onChange({ ...p, ...patch });

  const updateMetric = (id: string, patch: Partial<SuccessMetric>) =>
    set({
      successMetrics: p.successMetrics.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    });
  const removeMetric = (id: string) =>
    set({ successMetrics: p.successMetrics.filter((m) => m.id !== id) });
  const addMetric = () =>
    set({ successMetrics: [...p.successMetrics, blankMetric()] });

  return (
    <div className="space-y-8">
      {/* Overview */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Overview
        </h2>
        <FormField
          label="Pilot Objective"
          helper="1 sentence. The single goal that defines pilot success."
          required
        >
          <Textarea
            rows={2}
            value={p.objective}
            onChange={(e) => set({ objective: e.target.value })}
            placeholder="Validate that AI-drafted case briefs reduce AML triage time by 60% without increasing false negatives."
          />
        </FormField>
        <FormField
          label="Scope"
          helper="Which teams, regions, or use cases are in."
        >
          <Textarea
            rows={2}
            value={p.scope}
            onChange={(e) => set({ scope: e.target.value })}
            placeholder="London-based AML team. Standard-risk alerts only — high-risk and SAR cases excluded from pilot."
          />
        </FormField>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            label="Duration (weeks)"
            helper="Typical range: 4–12 weeks."
          >
            <Input
              type="number"
              min={1}
              max={52}
              value={p.durationWeeks}
              onChange={(e) =>
                set({ durationWeeks: parseInt(e.target.value) || 4 })
              }
            />
          </FormField>
          <FormField
            label="Pilot Users"
            helper="Press Enter to add each user. Include name and role."
          >
            <ChipInput
              value={p.pilotUsers}
              onChange={(v) => set({ pilotUsers: v })}
              placeholder="e.g. Alice Chen — AML Analyst"
              ariaLabel="Pilot users"
            />
          </FormField>
        </div>
      </section>

      <Separator />

      {/* Baseline + target */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Baseline & Target
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            label="Baseline Measurement"
            helper="Quantify today's performance. Numbers make the pilot defensible."
          >
            <Textarea
              rows={2}
              value={p.baselineMeasurement}
              onChange={(e) => set({ baselineMeasurement: e.target.value })}
              placeholder="Average 4 hours per case. ~30 cases/analyst/week. ~12% escalation rate."
            />
          </FormField>
          <FormField
            label="Target Outcome"
            helper="What you expect to see post-AI."
          >
            <Textarea
              rows={2}
              value={p.targetOutcome}
              onChange={(e) => set({ targetOutcome: e.target.value })}
              placeholder="Under 45 minutes per case. ~80 cases/analyst/week. Escalation rate ±2pp vs baseline."
            />
          </FormField>
        </div>
      </section>

      <Separator />

      {/* Workflows */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Workflow Scope
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            label="Included Workflows"
            helper="Press Enter to add each. Pulled from your Workflow tab."
          >
            <ChipInput
              value={p.includedWorkflows}
              onChange={(v) => set({ includedWorkflows: v })}
              placeholder="e.g. Alert intake"
              suggestions={workflowNames}
              ariaLabel="Included workflows"
            />
          </FormField>
          <FormField
            label="Excluded Workflows"
            helper="Workflows out of scope for the pilot."
          >
            <ChipInput
              value={p.excludedWorkflows}
              onChange={(v) => set({ excludedWorkflows: v })}
              placeholder="e.g. SAR filing"
              ariaLabel="Excluded workflows"
            />
          </FormField>
        </div>
      </section>

      <Separator />

      {/* Success metrics */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Success Metrics
          </h2>
          <span className="text-xs text-muted-foreground">
            {p.successMetrics.length} metric
            {p.successMetrics.length !== 1 ? "s" : ""}
          </span>
        </div>
        {p.successMetrics.length === 0 && (
          <div className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            No success metrics defined yet. Add at least one measurable metric
            so the pilot has clear sign-off criteria.
          </div>
        )}
        {p.successMetrics.map((m) => (
          <MetricRow
            key={m.id}
            metric={m}
            onUpdate={(patch) => updateMetric(m.id, patch)}
            onRemove={() => removeMetric(m.id)}
          />
        ))}
        <button
          type="button"
          onClick={addMetric}
          className="w-full rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors"
        >
          + Add success metric
        </button>
      </section>

      <Separator />

      {/* Launch + rollback criteria */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Launch & Rollback Criteria
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            label="Launch Criteria"
            helper="Conditions that must be met before pilot starts. Press Enter to add each."
          >
            <ChipInput
              value={p.launchCriteria}
              onChange={(v) => set({ launchCriteria: v })}
              placeholder="e.g. Accuracy ≥ 85% on test set"
              ariaLabel="Launch criteria"
            />
          </FormField>
          <FormField
            label="Rollback Criteria"
            helper="Triggers that pause or end the pilot. Press Enter to add each."
          >
            <ChipInput
              value={p.rollbackCriteria}
              onChange={(v) => set({ rollbackCriteria: v })}
              placeholder="e.g. False negative rate > 5%"
              ariaLabel="Rollback criteria"
            />
          </FormField>
        </div>
      </section>
    </div>
  );
}
