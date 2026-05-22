// Starter packs — one-click bundles of pre-canned systems / workflows /
// stakeholders that match a customer's industry. Lowers blank-page friction
// for users who don't want to fill 30+ fields from scratch.
//
// Each pack is a small Partial<> bundle; the import flow runs each entry
// through the appropriate factory (newSystem / newStep / blankStakeholder)
// so smart defaults from Discovery still apply, then merges into the
// project.

import type {
  CustomerSystem,
  WorkflowStep,
  Stakeholder,
  Industry,
} from "@/lib/types";

export type StarterPack = {
  id: string;
  label: string;
  industries: Industry[];
  description: string;
  systems: Partial<CustomerSystem>[];
  workflows: Partial<WorkflowStep>[];
  stakeholders: Partial<Stakeholder>[];
};

// Industry-keyed packs. Multiple packs may match a single industry; "other"
// shows all packs so users with non-listed industries can browse.
export const STARTER_PACKS: StarterPack[] = [
  {
    id: "fintech-aml",
    label: "Fintech AML stack",
    industries: ["fintech"],
    description:
      "Typical anti-money-laundering deployment: transaction monitoring + KYC + sanctions screening + SAR filing.",
    systems: [
      {
        name: "Actimize",
        type: "case_management",
        accessMethod: "api",
        dataSensitivity: "regulated",
        integrationComplexity: "high",
        notes: "Transaction monitoring + case management",
      },
      {
        name: "World-Check",
        type: "data_warehouse",
        accessMethod: "api",
        dataSensitivity: "regulated",
        integrationComplexity: "medium",
        notes: "Sanctions + PEP screening reference data",
      },
      {
        name: "Salesforce Financial Services Cloud",
        type: "crm",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "low",
      },
      {
        name: "Splunk",
        type: "data_warehouse",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "medium",
        notes: "Transaction audit log + retention",
      },
      {
        name: "goAML (FIU)",
        type: "core_system",
        accessMethod: "manual_upload",
        dataSensitivity: "regulated",
        integrationComplexity: "high",
        notes: "Regulator-facing SAR submission portal",
      },
    ],
    workflows: [
      {
        name: "Alert intake",
        description: "Triage incoming AML alerts from transaction monitoring",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "ai_assisted",
      },
      {
        name: "Customer + transaction enrichment",
        description: "Pull KYC, history, and sanctions match into case file",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "automated",
      },
      {
        name: "Case narrative drafting",
        description:
          "Write the analyst summary explaining the alert disposition",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "ai_assisted",
      },
      {
        name: "Supervisor review + SAR decision",
        description: "Supervisor approves close vs escalate to SAR",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "low",
        futureState: "requires_approval",
      },
      {
        name: "SAR filing",
        description: "Submit to FIU (e.g. NCA/FinCEN) via goAML portal",
        manualEffort: "high",
        frequency: "weekly",
        automationPotential: "medium",
        futureState: "requires_approval",
      },
    ],
    stakeholders: [
      {
        role: "Head of Financial Crime",
        involvement: "sponsor",
        influence: "high",
        concerns: ["Regulator scrutiny", "False negative rate"],
      },
      {
        role: "MLRO (Money Laundering Reporting Officer)",
        involvement: "decision_maker",
        influence: "high",
        concerns: ["Audit defensibility", "SAR quality"],
      },
      {
        role: "AML Analyst (Tier 1)",
        involvement: "end_user",
        influence: "medium",
        concerns: ["Workload reduction", "Trust in AI output"],
      },
    ],
  },
  {
    id: "legaltech-contract",
    label: "Legaltech contract review stack",
    industries: ["legaltech"],
    description:
      "Document-heavy contract analysis: ingest + clause extraction + risk flagging + redline.",
    systems: [
      {
        name: "iManage",
        type: "document_management",
        accessMethod: "api",
        dataSensitivity: "regulated",
        integrationComplexity: "medium",
      },
      {
        name: "Microsoft 365",
        type: "document_management",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "low",
      },
      {
        name: "Kira / Luminance (contract review)",
        type: "core_system",
        accessMethod: "api",
        dataSensitivity: "regulated",
        integrationComplexity: "medium",
      },
      {
        name: "DocuSign CLM",
        type: "core_system",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "medium",
      },
    ],
    workflows: [
      {
        name: "Document intake + classification",
        description: "Receive contract, classify type (NDA / MSA / SOW)",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "high",
        futureState: "ai_assisted",
      },
      {
        name: "Clause extraction",
        description:
          "Pull key clauses (termination, liability, IP) into review grid",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "automated",
      },
      {
        name: "Risk flagging",
        description:
          "Compare against playbook; flag deviations for partner review",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "ai_assisted",
      },
      {
        name: "Partner sign-off",
        description: "Senior counsel reviews flagged items + approves redline",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "low",
        futureState: "requires_approval",
      },
    ],
    stakeholders: [
      {
        role: "Managing Partner",
        involvement: "sponsor",
        influence: "high",
        concerns: ["Client confidentiality", "Liability exposure"],
      },
      {
        role: "Senior Associate",
        involvement: "decision_maker",
        influence: "high",
        concerns: ["Quality consistency", "Time savings"],
      },
      {
        role: "Junior Associate",
        involvement: "end_user",
        influence: "medium",
        concerns: ["Learning curve", "Career impact"],
      },
    ],
  },
  {
    id: "hardware-ops",
    label: "Hardware ops monitoring stack",
    industries: ["industrial"],
    description:
      "Field-ops + signal-driven workflow: device telemetry + alerts + ticket dispatch.",
    systems: [
      {
        name: "Prometheus + Grafana",
        type: "data_warehouse",
        accessMethod: "api",
        dataSensitivity: "medium",
        integrationComplexity: "low",
      },
      {
        name: "ServiceNow ITSM",
        type: "ticketing",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "medium",
      },
      {
        name: "PagerDuty",
        type: "core_system",
        accessMethod: "api",
        dataSensitivity: "medium",
        integrationComplexity: "low",
      },
      {
        name: "Field Service Mobile App",
        type: "custom",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "medium",
      },
    ],
    workflows: [
      {
        name: "Telemetry ingestion",
        description: "Stream device metrics into monitoring layer",
        manualEffort: "low",
        frequency: "daily",
        automationPotential: "high",
        futureState: "automated",
      },
      {
        name: "Anomaly detection + alert triage",
        description: "Filter noise, classify severity, suggest probable cause",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "ai_assisted",
      },
      {
        name: "Ticket dispatch to field engineer",
        description: "Route to nearest available technician with skill match",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "high",
        futureState: "automated",
      },
      {
        name: "On-site diagnosis + repair",
        description: "Engineer performs physical inspection and fix",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "low",
        futureState: "human_led",
      },
    ],
    stakeholders: [
      {
        role: "Director of Field Operations",
        involvement: "sponsor",
        influence: "high",
        concerns: ["Mean time to repair", "Customer SLA"],
      },
      {
        role: "Ops Engineering Lead",
        involvement: "technical_owner",
        influence: "high",
        concerns: ["Alert noise", "Integration burden"],
      },
      {
        role: "Field Engineer",
        involvement: "end_user",
        influence: "medium",
        concerns: ["Workflow disruption", "Mobile UX"],
      },
    ],
  },
  {
    id: "enterprise-support",
    label: "Enterprise support agent stack",
    industries: ["enterprise_saas"],
    description:
      "Customer support automation: ticket triage + draft replies + escalation.",
    systems: [
      {
        name: "Zendesk",
        type: "ticketing",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "low",
      },
      {
        name: "Confluence",
        type: "document_management",
        accessMethod: "api",
        dataSensitivity: "medium",
        integrationComplexity: "low",
      },
      {
        name: "Salesforce Service Cloud",
        type: "crm",
        accessMethod: "api",
        dataSensitivity: "high",
        integrationComplexity: "medium",
      },
      {
        name: "Slack (internal)",
        type: "chat",
        accessMethod: "api",
        dataSensitivity: "medium",
        integrationComplexity: "low",
      },
    ],
    workflows: [
      {
        name: "Ticket intake + classification",
        description: "Tag inbound tickets by product area + urgency",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "high",
        futureState: "automated",
      },
      {
        name: "Draft reply from KB",
        description: "Suggest answer using internal docs + past tickets",
        manualEffort: "high",
        frequency: "daily",
        automationPotential: "high",
        futureState: "ai_assisted",
      },
      {
        name: "Agent review + send",
        description: "Human reviews suggested reply, edits, sends",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "low",
        futureState: "requires_approval",
      },
      {
        name: "Escalation to engineering",
        description: "Hand off complex tickets via Slack to product engineer",
        manualEffort: "medium",
        frequency: "daily",
        automationPotential: "medium",
        futureState: "ai_assisted",
      },
    ],
    stakeholders: [
      {
        role: "VP Customer Success",
        involvement: "sponsor",
        influence: "high",
        concerns: ["CSAT", "Time to resolution"],
      },
      {
        role: "Support Team Lead",
        involvement: "decision_maker",
        influence: "high",
        concerns: ["Agent productivity", "Quality consistency"],
      },
      {
        role: "Support Agent",
        involvement: "end_user",
        influence: "medium",
        concerns: ["Trust in AI suggestions", "Workload"],
      },
    ],
  },
];

// Picks the packs relevant for an industry. For "other" industries returns
// all packs so the user can browse what's available.
export function packsForIndustry(industry: Industry): StarterPack[] {
  if (industry === "other") return STARTER_PACKS;
  return STARTER_PACKS.filter((p) => p.industries.includes(industry));
}
