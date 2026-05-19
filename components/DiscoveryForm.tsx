"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, ChipInput, FieldGroup } from "@/components/ui/form-field";
import { StakeholderEditor } from "@/components/StakeholderEditor";
import type { OnboardingProject, CustomerProfile, DiscoveryInput, Stakeholder } from "@/lib/types";

type Props = {
  project: OnboardingProject;
  onUpdate: (patch: Partial<OnboardingProject>) => void;
};

const REGULATORY_SUGGESTIONS = ["FCA", "FATF", "GDPR", "PSD2", "ISO 13849", "SRA", "ICO", "HIPAA", "SOC 2", "DORA", "MiFID II"];

const CONSTRAINT_SUGGESTIONS = [
  "DPA required before data transfer",
  "No PII to external models",
  "Security review needed",
  "Budget approval pending",
  "On-prem deployment only",
  "EU data residency",
  "SSO via Okta required",
  "Legacy system integration",
];

const KNOWN_RISK_SUGGESTIONS = [
  "Analyst trust in AI",
  "Regulator scrutiny",
  "Data quality variance",
  "Integration complexity",
  "Adoption risk",
  "Change management",
  "Audit trail gaps",
  "Model drift",
];

// Bridge between the string-typed DiscoveryInput fields and ChipInput<string[]>.
// Newline-separated so existing consumers (artifact templates, missing-info
// engine that does .includes("dpa")) still read these as readable strings.
const toChips = (s: string): string[] =>
  s ? s.split(/\r?\n/).map((v) => v.trim()).filter(Boolean) : [];
const fromChips = (arr: string[]): string => arr.join("\n");

const CURRENT_PROCESS_EXAMPLE = `1. Transaction monitoring tool fires alert → analyst opens case in Actimize
2. Manually queries KYC, sanctions (World-Check), and transaction history
3. Writes free-text narrative summarising findings
4. Routes to supervisor for SAR / close decision
5. Supervisor reviews, attaches evidence, files SAR or closes case
6. Case archived to compliance vault for 7-year retention`;

const SUCCESS_DEF_EXAMPLE = `By end of pilot (Q4 2026), 70% of standard-risk alerts will be triaged via the AI case brief with audit completeness ≥ baseline, false-negative rate within 2pp of baseline, and zero PII incidents.`;

export function DiscoveryForm({ project, onUpdate }: Props) {
  const { customer, discovery } = project;

  const setCustomer = useCallback(
    (patch: Partial<CustomerProfile>) => {
      onUpdate({ customer: { ...customer, ...patch } });
    },
    [customer, onUpdate]
  );

  const setDiscovery = useCallback(
    (patch: Partial<DiscoveryInput>) => {
      onUpdate({ discovery: { ...discovery, ...patch } });
    },
    [discovery, onUpdate]
  );

  // ── Completion status per section ──────────────────────────────────────────
  const profileFields = [customer.companyName, customer.primaryUseCase, customer.businessProblem, customer.desiredOutcome];
  const profileComplete = profileFields.filter(Boolean).length;
  const discoveryFields = [discovery.buyerTeam, discovery.implementationDeadline, discovery.usersAffected, discovery.currentProcess, discovery.successDefinition];
  const discoveryComplete = discoveryFields.filter(Boolean).length;

  return (
    <div className="space-y-5">
      <FieldGroup
        title="Customer Profile"
        helper="Who they are and what business outcome they're chasing. This drives the executive summary and the deployment pack framing."
        status={`${profileComplete}/${profileFields.length} filled`}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField id="companyName" label="Company Name" required>
            <Input
              id="companyName"
              value={customer.companyName}
              onChange={(e) => setCustomer({ companyName: e.target.value })}
              placeholder="Meridian Bank"
            />
          </FormField>

          <FormField id="industry" label="Industry">
            <Select value={customer.industry} onValueChange={(v) => setCustomer({ industry: v as CustomerProfile["industry"] })}>
              <SelectTrigger id="industry"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fintech">Fintech</SelectItem>
                <SelectItem value="legaltech">Legaltech</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
                <SelectItem value="enterprise_saas">Enterprise SaaS</SelectItem>
                <SelectItem value="public_sector">Public Sector</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="companySize" label="Company Size">
            <Select value={customer.companySize} onValueChange={(v) => setCustomer({ companySize: v as CustomerProfile["companySize"] })}>
              <SelectTrigger id="companySize"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="startup">Startup</SelectItem>
                <SelectItem value="mid_market">Mid-Market</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="urgency" label="Urgency" helper="How time-pressured is this deployment?">
            <Select value={customer.urgency} onValueChange={(v) => setCustomer({ urgency: v as CustomerProfile["urgency"] })}>
              <SelectTrigger id="urgency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="technicalMaturity" label="Technical Maturity" helper="How sophisticated is their engineering org?">
            <Select value={customer.technicalMaturity} onValueChange={(v) => setCustomer({ technicalMaturity: v as CustomerProfile["technicalMaturity"] })}>
              <SelectTrigger id="technicalMaturity"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="primaryUseCase" label="Primary Use Case" helper="1 line. The single thing AI will do.">
            <Input
              id="primaryUseCase"
              value={customer.primaryUseCase}
              onChange={(e) => setCustomer({ primaryUseCase: e.target.value })}
              placeholder="AML alert triage"
            />
          </FormField>
        </div>

        <FormField
          id="businessProblem"
          label="Business Problem"
          helper="1-2 sentences. Focus on the pain, not the proposed solution."
          required
        >
          <Textarea
            id="businessProblem"
            rows={3}
            value={customer.businessProblem}
            onChange={(e) => setCustomer({ businessProblem: e.target.value })}
            placeholder="AML analysts spend 4 hours per alert manually pulling KYC, transaction history, and sanctions data into case notes. Backlog is 1,200 alerts and growing."
          />
        </FormField>

        <FormField
          id="desiredOutcome"
          label="Desired Outcome"
          helper="What success looks like. Quantify where possible — time reduction, error rate, throughput."
        >
          <Textarea
            id="desiredOutcome"
            rows={2}
            value={customer.desiredOutcome}
            onChange={(e) => setCustomer({ desiredOutcome: e.target.value })}
            placeholder="Reduce average alert-to-decision time from 4 hours to under 45 minutes while maintaining audit quality."
          />
        </FormField>

        <FormField
          label="Regulatory Context"
          helper="Type to add custom or click suggestions. Drives compliance requirements in the deployment pack."
          optional
        >
          <ChipInput
            value={customer.regulatoryContext ?? []}
            onChange={(next) => setCustomer({ regulatoryContext: next })}
            placeholder="Type a regulation and press Enter…"
            suggestions={REGULATORY_SUGGESTIONS}
            ariaLabel="Regulatory context"
          />
        </FormField>
      </FieldGroup>

      <FieldGroup
        title="Discovery Call"
        helper="What you learned in conversations with the customer. Feeds workflow mapping, risks, and pilot scoping."
        status={`${discoveryComplete}/${discoveryFields.length} filled`}
      >
        {/* Logical sub-section 1: the meeting context */}
        <SubSectionHeader>Meeting context</SubSectionHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            id="buyerTeam"
            label="Buyer / Stakeholder Team"
            helper="The team championing this internally — drives the conversation cadence."
          >
            <Input
              id="buyerTeam"
              value={discovery.buyerTeam}
              onChange={(e) => setDiscovery({ buyerTeam: e.target.value })}
              placeholder="Financial Crime Operations"
            />
          </FormField>

          <FormField
            id="implementationDeadline"
            label="Implementation Deadline"
            helper="A specific date or quarter, e.g. “Q3 2026” or “2026-09-30”."
            optional
          >
            <Input
              id="implementationDeadline"
              type="text"
              value={discovery.implementationDeadline}
              onChange={(e) => setDiscovery({ implementationDeadline: e.target.value })}
              placeholder="Q3 2026"
            />
          </FormField>

          <FormField
            id="usersAffected"
            label="Users Affected"
            helper="Approximate headcount + roles. Drives pilot user selection."
            optional
          >
            <Input
              id="usersAffected"
              value={discovery.usersAffected}
              onChange={(e) => setDiscovery({ usersAffected: e.target.value })}
              placeholder="12 AML analysts, 3 supervisors"
            />
          </FormField>

          <FormField
            id="riskLevel"
            label="Overall Risk Level"
            helper="Your gut-feel given regulated data, change scope, and customer maturity."
          >
            <Select value={discovery.riskLevel} onValueChange={(v) => setDiscovery({ riskLevel: v as DiscoveryInput["riskLevel"] })}>
              <SelectTrigger id="riskLevel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — straightforward deployment</SelectItem>
                <SelectItem value="medium">Medium — typical enterprise risk</SelectItem>
                <SelectItem value="high">High — regulated data or critical workflow</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Logical sub-section 2: process + scope */}
        <SubSectionHeader>Process & scope</SubSectionHeader>

        <ExampleField
          id="currentProcess"
          label="Current Process"
          helper="A short summary of how they work today, end-to-end. You'll map this in detail later on the Workflow tab — this is the elevator-pitch version."
          example={CURRENT_PROCESS_EXAMPLE}
          required
        >
          <Textarea
            id="currentProcess"
            rows={5}
            value={discovery.currentProcess}
            onChange={(e) => setDiscovery({ currentProcess: e.target.value })}
            placeholder="A few sentences, or 3–6 numbered steps. Click ‘See example’ above for a sample."
          />
        </ExampleField>

        <FormField
          label="Constraints"
          helper="What bounds the solution space. Press Enter to add each constraint, or pick from suggestions."
          optional
        >
          <ChipInput
            value={toChips(discovery.constraints)}
            onChange={(v) => setDiscovery({ constraints: fromChips(v) })}
            placeholder="Type a constraint and press Enter…"
            suggestions={CONSTRAINT_SUGGESTIONS}
            ariaLabel="Constraints"
          />
        </FormField>

        <FormField
          label="Known Risks"
          helper="What the customer or your team has already flagged. These flow into the Risk Register."
          optional
        >
          <ChipInput
            value={toChips(discovery.knownRisks)}
            onChange={(v) => setDiscovery({ knownRisks: fromChips(v) })}
            placeholder="Type a known risk and press Enter…"
            suggestions={KNOWN_RISK_SUGGESTIONS}
            ariaLabel="Known risks"
          />
        </FormField>

        <ExampleField
          id="successDefinition"
          label="Success Definition"
          helper="The single sentence the customer would use to declare the pilot a win. Make it measurable and time-bounded."
          example={SUCCESS_DEF_EXAMPLE}
        >
          <Textarea
            id="successDefinition"
            rows={3}
            value={discovery.successDefinition}
            onChange={(e) => setDiscovery({ successDefinition: e.target.value })}
            placeholder="By [date], [metric] will [direction] from [baseline] to [target]. Click ‘See example’ for a sample."
          />
        </ExampleField>
      </FieldGroup>

      <FieldGroup
        title="Stakeholders"
        helper="Named people across executive sponsorship, technical ownership, and end-user roles. Required before pilot launch."
        status={`${project.stakeholders.length} added`}
      >
        <StakeholderEditor
          stakeholders={project.stakeholders}
          onChange={(stakeholders: Stakeholder[]) => onUpdate({ stakeholders })}
        />
      </FieldGroup>
    </div>
  );
}

// ── Small UI helpers ──────────────────────────────────────────────────────

function SubSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mt-2 first:mt-0 -mb-1">
      {children}
    </h3>
  );
}

// ExampleField wraps FormField with a "See example" toggle that shows a sample
// in a read-only block above the input. Reduces blank-page anxiety without
// committing the example as the actual value.
function ExampleField({
  id, label, helper, example, required, children,
}: {
  id?: string;
  label: string;
  helper: string;
  example: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const [showExample, setShowExample] = useState(false);
  const helperWithToggle = (
    <span className="flex items-center gap-2 flex-wrap">
      <span>{helper}</span>
      <button
        type="button"
        onClick={() => setShowExample((v) => !v)}
        className="text-[11px] text-primary hover:text-primary/80 underline underline-offset-2 hover:no-underline"
      >
        {showExample ? "Hide example" : "See example"}
      </button>
    </span>
  );

  return (
    <div className="space-y-1.5">
      <FormField id={id} label={label} required={required} helper="">
        {showExample && (
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 mb-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold block mb-1">Example</span>
            {example}
          </div>
        )}
        {children}
      </FormField>
      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{helperWithToggle}</p>
    </div>
  );
}
