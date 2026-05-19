"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { detectMissingInfo } from "@/lib/missing-info-engine";
import { generateRisks } from "@/lib/risk-engine";
import { generateRequirements } from "@/lib/requirements-engine";
import { cn } from "@/lib/utils";

// Shows how raw inputs flow downstream into structured artifacts and finally
// into the deployment pack. Helps the user understand "how everything hangs
// together" — every box shows live counts and links to its source tab.
export function DataFlowDiagram() {
  const { project } = useWorkspace();
  if (!project) return null;

  const generatedReqs = generateRequirements(project);
  const generatedRisks = generateRisks(project);
  const missingInfo = detectMissingInfo(project);

  const inputs = {
    discovery: !!project.discovery.currentProcess,
    workflows: project.workflows.length,
    systems: project.systems.length,
    dataSources: project.dataSources.length,
    stakeholders: project.stakeholders.length,
    notes: !!project.meetingNotes,
  };

  const derived = {
    requirementsAuto: generatedReqs.length,
    requirementsManual: project.requirements.length,
    risksAuto: generatedRisks.length,
    risksTotal: project.risks.length,
    missingInfoItems: missingInfo.length,
    currentMap: !!project.visualisations?.currentStateWorkflowMap,
    futureMap: !!project.visualisations?.futureStateAIWorkflowMap,
  };

  const outputs = {
    pilot: !!project.pilotPlan?.objective,
    artifacts: !!project.outputs?.executiveSummary,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How Everything Connects
        </h2>
        <p className="text-xs text-muted-foreground">Live data flow across the project</p>
      </div>

      <div className="rounded-lg border bg-muted/10 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
          {/* Column 1: Raw inputs */}
          <Column projectId={project.id} title="Raw Inputs" subtitle="What you capture" colorClass="bg-blue-500" textColorClass="text-blue-700">
            <FlowCard
              href={`/workspace/${project.id}/discovery`}
              label="Discovery"
              detail={inputs.discovery ? "Captured" : "Not yet captured"}
              tone={inputs.discovery ? "ok" : "warn"}
            />
            <FlowCard
              href={`/workspace/${project.id}/discovery`}
              label={`${inputs.stakeholders} stakeholder${inputs.stakeholders !== 1 ? "s" : ""}`}
              detail={inputs.stakeholders > 0 ? "Named" : "Add stakeholders"}
              tone={inputs.stakeholders > 0 ? "ok" : "warn"}
            />
            <FlowCard
              href={`/workspace/${project.id}`}
              label="Meeting notes"
              detail={inputs.notes ? "Saved" : "Optional"}
              tone={inputs.notes ? "ok" : "neutral"}
            />
          </Column>

          <Arrow />

          {/* Column 2: Structured design */}
          <Column projectId={project.id} title="Structured Design" subtitle="Maps + lists" colorClass="bg-violet-500" textColorClass="text-violet-700">
            <FlowCard
              href={`/workspace/${project.id}/workflow`}
              label={`${inputs.workflows} workflow step${inputs.workflows !== 1 ? "s" : ""}`}
              detail={
                derived.currentMap && derived.futureMap ? "2 maps generated"
                  : derived.currentMap ? "Current-state mapped"
                    : derived.futureMap ? "Future-state mapped"
                      : inputs.workflows > 0 ? "Add visual map" : "No steps yet"
              }
              tone={derived.currentMap && derived.futureMap ? "ok" : inputs.workflows > 0 ? "info" : "warn"}
            />
            <FlowCard
              href={`/workspace/${project.id}/systems`}
              label={`${inputs.systems} system${inputs.systems !== 1 ? "s" : ""}, ${inputs.dataSources} source${inputs.dataSources !== 1 ? "s" : ""}`}
              detail={inputs.systems > 0 ? "Documented" : "Add systems"}
              tone={inputs.systems > 0 ? "ok" : "warn"}
            />
          </Column>

          <Arrow />

          {/* Column 3: Derived intelligence */}
          <Column projectId={project.id} title="Derived Intelligence" subtitle="Auto-generated from above" colorClass="bg-amber-500" textColorClass="text-amber-700">
            <FlowCard
              href={`/workspace/${project.id}/requirements`}
              label={`${derived.requirementsAuto + derived.requirementsManual} requirement${derived.requirementsAuto + derived.requirementsManual !== 1 ? "s" : ""}`}
              detail={derived.requirementsAuto > 0 ? `${derived.requirementsAuto} auto + ${derived.requirementsManual} custom` : "Add inputs to auto-generate"}
              tone={derived.requirementsAuto > 0 ? "ok" : "warn"}
            />
            <FlowCard
              href={`/workspace/${project.id}/risks`}
              label={`${derived.risksTotal} risk${derived.risksTotal !== 1 ? "s" : ""}`}
              detail={derived.risksAuto > 0 ? `${derived.risksAuto} engine-detected` : "Add inputs to detect risks"}
              tone={derived.risksTotal > 0 ? "ok" : "warn"}
            />
            <FlowCard
              href={`/workspace/${project.id}/requirements`}
              label={`${derived.missingInfoItems} open question${derived.missingInfoItems !== 1 ? "s" : ""}`}
              detail={derived.missingInfoItems === 0 ? "All resolved" : "Needs attention"}
              tone={derived.missingInfoItems === 0 ? "ok" : "warn"}
            />
          </Column>

          <Arrow />

          {/* Column 4: Deployment pack */}
          <Column projectId={project.id} title="Deployment Pack" subtitle="What you ship" colorClass="bg-emerald-500" textColorClass="text-emerald-700">
            <FlowCard
              href={`/workspace/${project.id}/pilot`}
              label="Pilot plan"
              detail={outputs.pilot ? "Defined" : "Not yet designed"}
              tone={outputs.pilot ? "ok" : "warn"}
            />
            <FlowCard
              href={`/workspace/${project.id}/outputs`}
              label="15 artifacts"
              detail={outputs.artifacts ? "Generated" : "Awaiting generation"}
              tone={outputs.artifacts ? "ok" : "warn"}
            />
          </Column>
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 text-center italic">
          Discovery + workflows feed requirements and risks. All inputs flow into the final deployment pack.
        </p>
      </div>
    </div>
  );
}

function Column({
  title,
  subtitle,
  colorClass,
  textColorClass,
  children,
}: {
  title: string;
  subtitle: string;
  colorClass: string;
  textColorClass: string;
  projectId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", colorClass)} />
        <p className={cn("text-[10px] font-bold uppercase tracking-wider", textColorClass)}>{title}</p>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1 ml-4">{subtitle}</p>
      <div className="space-y-1.5 pt-1">{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden md:flex items-center justify-center -mx-2">
      <div className="text-muted-foreground/40 text-2xl select-none">→</div>
    </div>
  );
}

function FlowCard({
  href,
  label,
  detail,
  tone,
}: {
  href: string;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "info" | "neutral";
}) {
  const toneStyles = {
    ok:      "bg-background border-emerald-200",
    warn:    "bg-background border-amber-200",
    info:    "bg-background border-blue-200",
    neutral: "bg-background border-border",
  };
  const detailColor = {
    ok:      "text-emerald-700",
    warn:    "text-amber-700",
    info:    "text-blue-700",
    neutral: "text-muted-foreground",
  };
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md border px-2.5 py-2 text-xs hover:shadow-sm transition-all",
        toneStyles[tone]
      )}
    >
      <p className="font-medium leading-tight">{label}</p>
      <p className={cn("text-[10px] leading-tight mt-0.5", detailColor[tone])}>{detail}</p>
    </Link>
  );
}
