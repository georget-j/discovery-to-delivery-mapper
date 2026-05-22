"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FormField,
  ChipInput,
  validateRequired,
} from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CHIP, ROLE_CHIP } from "@/lib/semantic-colors";
import { Surface } from "@/components/ui/surface";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { StarterPackPicker } from "@/components/StarterPackPicker";
import type {
  Stakeholder,
  StakeholderInvolvement,
  StakeholderInfluence,
  OnboardingProject,
} from "@/lib/types";

type Props = {
  stakeholders: Stakeholder[];
  onChange: (next: Stakeholder[]) => void;
};

const INVOLVEMENT_OPTIONS: {
  value: StakeholderInvolvement;
  label: string;
  hint: string;
}[] = [
  {
    value: "sponsor",
    label: "Executive Sponsor",
    hint: "Owns budget + escalation path",
  },
  {
    value: "decision_maker",
    label: "Decision Maker",
    hint: "Signs off on scope and go-live",
  },
  {
    value: "technical_owner",
    label: "Technical Owner",
    hint: "Owns integration + environments",
  },
  {
    value: "business_owner",
    label: "Business Owner",
    hint: "Owns the affected workflow",
  },
  {
    value: "end_user",
    label: "End User",
    hint: "Will use the product day-to-day",
  },
  {
    value: "legal_security",
    label: "Legal / Security",
    hint: "DPA, security review, compliance",
  },
  {
    value: "procurement",
    label: "Procurement",
    hint: "Contract, MSA, vendor onboarding",
  },
];

const INVOLVEMENT_LABELS: Record<StakeholderInvolvement, string> =
  Object.fromEntries(
    INVOLVEMENT_OPTIONS.map((o) => [o.value, o.label]),
  ) as Record<StakeholderInvolvement, string>;

// Stakeholder involvement is an IDENTITY axis, not a severity axis — each
// role gets a distinct hue from the ROLE_CHIP palette. The exceptions
// (legal_security → critical, end_user → neutral) keep semantic weight.
const INVOLVEMENT_COLORS: Record<StakeholderInvolvement, string> = {
  sponsor: ROLE_CHIP.purple,
  decision_maker: CHIP.info,
  technical_owner: CHIP.success,
  business_owner: ROLE_CHIP.amber,
  end_user: ROLE_CHIP.slate,
  legal_security: CHIP.critical,
  procurement: ROLE_CHIP.cyan,
};

const INFLUENCE_COLORS: Record<StakeholderInfluence, string> = {
  high: "bg-foreground/10 text-foreground border-foreground/20",
  medium: CHIP.neutral,
  low: "bg-muted/50 text-muted-foreground/70 border-muted-foreground/10",
};

const COMMON_CONCERNS = [
  "Regulatory compliance",
  "Data privacy",
  "Audit trail",
  "Change management",
  "Adoption risk",
  "Cost / ROI",
  "Integration complexity",
  "Vendor lock-in",
];

// Smart default: team from Discovery.buyerTeam so users don't retype the
// Sponsoring Team for every stakeholder.
function blankStakeholder(project?: OnboardingProject | null): Stakeholder {
  return {
    id: generateId(),
    name: "",
    role: "",
    team: project?.discovery.buyerTeam ?? "",
    influence: "medium",
    involvement: "end_user",
    concerns: [],
    requiredActions: [],
  };
}

export function StakeholderEditor({ stakeholders, onChange }: Props) {
  const { project } = useWorkspace();
  const updateOne = (id: string, patch: Partial<Stakeholder>) => {
    onChange(stakeholders.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeOne = (id: string) => {
    onChange(stakeholders.filter((s) => s.id !== id));
  };
  const addOne = () => {
    onChange([...stakeholders, blankStakeholder(project)]);
  };

  // Coverage hints — used to guide users toward including the key roles.
  const hasSponsor = stakeholders.some((s) => s.involvement === "sponsor");
  const hasTechOwner = stakeholders.some(
    (s) => s.involvement === "technical_owner",
  );
  const hasEndUser = stakeholders.some((s) => s.involvement === "end_user");

  const coverage = [
    { ok: hasSponsor, label: "Executive Sponsor" },
    { ok: hasTechOwner, label: "Technical Owner" },
    { ok: hasEndUser, label: "End User" },
  ];

  return (
    <div className="space-y-3">
      {stakeholders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Coverage:</span>
          {coverage.map((c) => (
            <span
              key={c.label}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded border",
                c.ok
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-muted/50 text-muted-foreground border-border",
              )}
            >
              {c.ok ? "✓" : "○"} {c.label}
            </span>
          ))}
        </div>
      )}

      {stakeholders.length === 0 && (
        <EmptyState
          icon="👥"
          title="No stakeholders added yet"
          body="Aim to identify at least an Executive Sponsor, a Technical Owner, and an End User."
          cta={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={addOne}
                className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
              >
                + Add first stakeholder
              </button>
              <StarterPackPicker
                target="stakeholders"
                label="Add a stakeholder pack"
              />
            </div>
          }
        />
      )}

      <div className="space-y-2">
        {stakeholders.map((s) => (
          <StakeholderRow
            key={s.id}
            stakeholder={s}
            onUpdate={(patch) => updateOne(s.id, patch)}
            onRemove={() => removeOne(s.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addOne}
        className="w-full rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors"
      >
        + Add stakeholder
      </button>
    </div>
  );
}

function StakeholderRow({
  stakeholder: s,
  onUpdate,
  onRemove,
}: {
  stakeholder: Stakeholder;
  onUpdate: (patch: Partial<Stakeholder>) => void;
  onRemove: () => void;
}) {
  // Default open if this is a brand-new stakeholder with no name yet.
  const [open, setOpen] = useState(!s.name);
  const [nameError, setNameError] = useState<string | undefined>();

  return (
    <Surface
      id={s.id}
      className={cn("scroll-mt-20", open && "ring-1 ring-primary/20")}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          {open ? (
            <div className="space-y-1">
              <Input
                value={s.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                onBlur={(e) =>
                  setNameError(
                    validateRequired(e.target.value, "Stakeholder name"),
                  )
                }
                aria-invalid={!!nameError}
                placeholder="Stakeholder name"
                className="h-7 text-sm font-medium"
                autoFocus
              />
              {nameError && (
                <p className="text-[11px] text-destructive" role="alert">
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium truncate">
              {s.name || (
                <span className="text-muted-foreground italic">
                  Unnamed stakeholder
                </span>
              )}
              {s.role && (
                <span className="text-muted-foreground font-normal ml-1">
                  — {s.role}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {s.team && !open && (
            <span className="text-xs text-muted-foreground">{s.team}</span>
          )}
          <Badge
            variant="outline"
            className={cn("text-xs", INVOLVEMENT_COLORS[s.involvement])}
          >
            {INVOLVEMENT_LABELS[s.involvement]}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-xs capitalize", INFLUENCE_COLORS[s.influence])}
          >
            {s.influence} infl.
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
            aria-label="Remove stakeholder"
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <>
          <Separator />
          <div className="px-4 py-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                label="Role"
                helper="Job title or function."
                flashOnSave={s.role}
              >
                <Input
                  value={s.role}
                  onChange={(e) => onUpdate({ role: e.target.value })}
                  placeholder="Chief Compliance Officer"
                />
              </FormField>
              <FormField
                label="Team"
                helper="Department or business unit."
                flashOnSave={s.team}
              >
                <Input
                  value={s.team}
                  onChange={(e) => onUpdate({ team: e.target.value })}
                  placeholder="Financial Crime Operations"
                />
              </FormField>
              <FormField
                label="Involvement"
                helper="What role they play in this deployment."
              >
                <Select
                  value={s.involvement}
                  onValueChange={(v) =>
                    onUpdate({ involvement: v as StakeholderInvolvement })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOLVEMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span>{o.label}</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          — {o.hint}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Influence"
                helper="How much weight their opinion carries."
              >
                <Select
                  value={s.influence}
                  onValueChange={(v) =>
                    onUpdate({ influence: v as StakeholderInfluence })
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
            </div>

            <FormField
              label="Concerns"
              helper="What worries them about this deployment. Press Enter to add each."
            >
              <ChipInput
                value={s.concerns}
                onChange={(v) => onUpdate({ concerns: v })}
                placeholder="e.g. regulatory scrutiny on AI decisions"
                suggestions={COMMON_CONCERNS}
                ariaLabel="Stakeholder concerns"
              />
            </FormField>

            <FormField
              label="Required Actions"
              helper="What they need to do for the deployment to succeed."
            >
              <ChipInput
                value={s.requiredActions}
                onChange={(v) => onUpdate({ requiredActions: v })}
                placeholder="e.g. approve DPA"
                ariaLabel="Required actions"
              />
            </FormField>
          </div>
        </>
      )}
    </Surface>
  );
}
