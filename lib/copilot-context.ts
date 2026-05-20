import type { OnboardingProject } from "@/lib/types";

// Compact serialisation of a project state for inclusion in a copilot LLM
// turn. Keeps the prompt under ~6 KB even on rich scenarios by stripping
// long-form free text fields and summarising lists.
export function projectContextBundle(project: OnboardingProject): string {
  const {
    customer,
    discovery,
    workflows,
    systems,
    dataSources,
    stakeholders,
    risks,
    requirements,
    pilotPlan,
  } = project;

  const lines: string[] = [];

  lines.push(`# Project: ${customer.companyName}`);
  lines.push(
    `Industry: ${customer.industry || "unspecified"} · Size: ${customer.companySize || "unspecified"} · Tech maturity: ${customer.technicalMaturity || "unspecified"}`,
  );
  if (customer.regulatoryContext?.length) {
    lines.push(`Regulatory: ${customer.regulatoryContext.join(", ")}`);
  }
  if (customer.businessProblem) {
    lines.push(`Business problem: ${truncate(customer.businessProblem, 240)}`);
  }
  if (customer.primaryUseCase) {
    lines.push(`Primary use case: ${truncate(customer.primaryUseCase, 200)}`);
  }
  if (customer.desiredOutcome) {
    lines.push(`Desired outcome: ${truncate(customer.desiredOutcome, 200)}`);
  }

  if (discovery.currentProcess) {
    lines.push(
      `\n## Current process\n${truncate(discovery.currentProcess, 400)}`,
    );
  }
  if (discovery.successDefinition) {
    lines.push(
      `\n## Success definition\n${truncate(discovery.successDefinition, 240)}`,
    );
  }
  if (discovery.implementationDeadline) {
    lines.push(`Deadline: ${discovery.implementationDeadline}`);
  }

  if (stakeholders.length > 0) {
    lines.push(`\n## Stakeholders (${stakeholders.length})`);
    for (const s of stakeholders.slice(0, 10)) {
      lines.push(
        `- [${s.id}] ${s.name} · ${s.role || "?"} · ${s.team || "?"} · involvement=${s.involvement} · influence=${s.influence}${s.concerns?.length ? ` · concerns: ${s.concerns.slice(0, 3).join(", ")}` : ""}`,
      );
    }
  }

  if (workflows.length > 0) {
    lines.push(`\n## Workflow steps (${workflows.length})`);
    for (const w of workflows.slice(0, 12)) {
      lines.push(
        `- [${w.id}] ${w.name} · owner=${w.ownerTeam || "?"} · auto=${w.automationPotential} · future=${w.futureState}${w.painPoints?.length ? ` · pain: ${w.painPoints.slice(0, 2).join("; ")}` : ""}`,
      );
    }
  }

  if (systems.length > 0) {
    lines.push(`\n## Systems (${systems.length})`);
    for (const s of systems.slice(0, 10)) {
      lines.push(
        `- [${s.id}] ${s.name} (${s.type}) · access=${s.accessMethod} · api=${s.apiAvailable} · sensitivity=${s.dataSensitivity} · complexity=${s.integrationComplexity}`,
      );
    }
  }

  if (dataSources.length > 0) {
    lines.push(`\n## Data sources (${dataSources.length})`);
    for (const d of dataSources.slice(0, 10)) {
      lines.push(
        `- [${d.id}] ${d.name} (${d.dataType}) · quality=${d.quality} · access=${d.accessStatus} · pii=${d.pii}`,
      );
    }
  }

  if (risks.length > 0) {
    lines.push(`\n## Risks (${risks.length})`);
    for (const r of risks.slice(0, 10)) {
      lines.push(
        `- [${r.id}] ${r.title} · ${r.severity}/${r.likelihood} · status=${r.status} · ${truncate(r.mitigation || "no mitigation", 100)}`,
      );
    }
  }

  if (requirements.length > 0) {
    lines.push(`\n## Requirements (${requirements.length})`);
    for (const r of requirements.slice(0, 12)) {
      lines.push(
        `- [${r.id}] ${r.title} · ${r.category}/${r.priority} · ${r.status}`,
      );
    }
  }

  if (pilotPlan?.objective) {
    lines.push(`\n## Pilot plan`);
    lines.push(`Objective: ${truncate(pilotPlan.objective, 240)}`);
    lines.push(
      `Duration: ${pilotPlan.durationWeeks ?? "?"} weeks · Users: ${pilotPlan.pilotUsers?.length ?? 0}`,
    );
    if (pilotPlan.successMetrics?.length) {
      lines.push(
        `Metrics: ${pilotPlan.successMetrics
          .slice(0, 5)
          .map((m) => m.name)
          .join(", ")}`,
      );
    }
  }

  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
