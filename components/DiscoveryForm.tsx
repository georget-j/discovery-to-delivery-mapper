"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, ChipInput, FieldGroup } from "@/components/ui/form-field";
import type { OnboardingProject, CustomerProfile, DiscoveryInput } from "@/lib/types";

type Props = {
  project: OnboardingProject;
  onUpdate: (patch: Partial<OnboardingProject>) => void;
};

const REGULATORY_SUGGESTIONS = ["FCA", "FATF", "GDPR", "PSD2", "ISO 13849", "SRA", "ICO", "HIPAA", "SOC 2", "DORA", "MiFID II"];

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
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            id="buyerTeam"
            label="Buyer / Stakeholder Team"
            helper="Who is championing this internally."
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
            helper="A date or quarter is fine. Drives phase planning."
            optional
          >
            <Input
              id="implementationDeadline"
              value={discovery.implementationDeadline}
              onChange={(e) => setDiscovery({ implementationDeadline: e.target.value })}
              placeholder="Q3 2026"
            />
          </FormField>

          <FormField
            id="usersAffected"
            label="Users Affected"
            helper="Headcount or team scope."
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
            helper="Your gut-feel on this deployment."
          >
            <Select value={discovery.riskLevel} onValueChange={(v) => setDiscovery({ riskLevel: v as DiscoveryInput["riskLevel"] })}>
              <SelectTrigger id="riskLevel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField
          id="currentProcess"
          label="Current Process"
          helper="How they do the work today, end-to-end. Bullet points or prose — whichever flows naturally."
          required
        >
          <Textarea
            id="currentProcess"
            rows={4}
            value={discovery.currentProcess}
            onChange={(e) => setDiscovery({ currentProcess: e.target.value })}
            placeholder="1. Transaction monitoring tool fires alert → 2. Analyst opens case in Actimize → 3. Manually queries KYC, World-Check, transaction history → 4. Writes narrative in free text → 5. Supervisor reviews → 6. Either closes or files SAR."
          />
        </FormField>

        <FormField
          id="constraints"
          label="Constraints"
          helper="Regulatory, technical, budget, timeline. Anything that bounds the solution space."
          optional
        >
          <Textarea
            id="constraints"
            rows={2}
            value={discovery.constraints}
            onChange={(e) => setDiscovery({ constraints: e.target.value })}
            placeholder="DPA required before any data transfer. Cannot send PII to external models. No CI/CD access until security review passes."
          />
        </FormField>

        <FormField
          id="knownRisks"
          label="Known Risks"
          helper="What the customer or your team has already flagged. Captured here so they show up in the risk register."
          optional
        >
          <Textarea
            id="knownRisks"
            rows={2}
            value={discovery.knownRisks}
            onChange={(e) => setDiscovery({ knownRisks: e.target.value })}
            placeholder="Analyst trust in AI recommendations. Regulator scrutiny on automated SAR decisions."
          />
        </FormField>

        <FormField
          id="successDefinition"
          label="Success Definition"
          helper="The single sentence the customer would use to declare the pilot a win. Should be measurable."
        >
          <Textarea
            id="successDefinition"
            rows={2}
            value={discovery.successDefinition}
            onChange={(e) => setDiscovery({ successDefinition: e.target.value })}
            placeholder="By end of pilot, 70% of alerts triaged via the AI case brief with audit completeness ≥ baseline and zero PII incidents."
          />
        </FormField>
      </FieldGroup>
    </div>
  );
}
