"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { assembleScopedPack, type PackScope } from "@/lib/markdown-export";
import type { OnboardingProject } from "@/lib/types";
import {
  getArtifactReadiness,
  type ArtifactKey,
  type ArtifactReadiness,
} from "@/lib/artifact-sources";

// One audience bundle: 4 of these render across the page.
type Bundle = {
  label: string;
  blurb: string;
  keys: ArtifactKey[];
  accent: string;
};

const BUNDLES: Bundle[] = [
  {
    label: "Customer-Facing",
    blurb: "Hand these to the customer. Sign-off, scope lock-in, comms.",
    keys: [
      "executiveSummary",
      "futureStateWorkflow",
      "pilotSuccessPlan",
      "stakeholderCommunicationPlan",
      "nextActionsChecklist",
    ],
    accent: "border-blue-300 bg-blue-50/60",
  },
  {
    label: "Internal",
    blurb: "Brief the rest of your team. Discovery, requirements, risk.",
    keys: [
      "customerDiscoverySummary",
      "requirementsMatrix",
      "missingInformationLog",
      "riskRegisterSummary",
      "implementationPlan",
    ],
    accent: "border-violet-300 bg-violet-50/60",
  },
  {
    label: "Technical",
    blurb: "Everything engineering needs on day one.",
    keys: [
      "currentStateWorkflow",
      "integrationAndApiPlan",
      "dataReadinessAssessment",
      "engineeringHandoff",
    ],
    accent: "border-emerald-300 bg-emerald-50/60",
  },
  {
    label: "Product",
    blurb: "What this engagement revealed about the product.",
    keys: ["productFeedbackMemo"],
    accent: "border-amber-300 bg-amber-50/60",
  },
];

const SUGGESTED_READ_ORDER: ArtifactKey[] = [
  "executiveSummary",
  "pilotSuccessPlan",
  "riskRegisterSummary",
];

const READINESS_LABEL: Record<ArtifactReadiness, string> = {
  rich: "Rich",
  usable: "Usable",
  thin: "Thin",
  empty: "No inputs",
};

const READINESS_DOT: Record<ArtifactReadiness, string> = {
  rich: "bg-emerald-500",
  usable: "bg-amber-500",
  thin: "bg-muted-foreground/40",
  empty: "bg-red-500",
};

type Props = {
  project: OnboardingProject;
  onPickArtifact: (key: ArtifactKey) => void;
  generatedAt: string | undefined;
  source: string | null;
  stale: boolean;
};

export function PackOverview({ project, onPickArtifact, generatedAt, source, stale }: Props) {
  // Group readiness counts. Used both in the top strip and per-card.
  const counts = useMemo(() => {
    const result = { rich: 0, usable: 0, thin: 0, empty: 0 } as Record<ArtifactReadiness, number>;
    for (const bundle of BUNDLES) {
      for (const key of bundle.keys) {
        result[getArtifactReadiness(project, key)] += 1;
      }
    }
    return result;
  }, [project]);

  const sourceLabel =
    source === "ai" ? "OpenAI (gpt-4o-mini)" :
    source === "template_fallback" ? "deterministic templates (AI response invalid)" :
    "deterministic templates";

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto space-y-6">
      {/* Top status strip */}
      <header className="space-y-2">
        <h2 className="text-base font-semibold">Pack overview</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          15 artifacts grouped by audience. Pick a bundle to start reading,
          or jump straight into an artifact from the sidebar.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
          {generatedAt && (
            <span>
              Generated <span className="font-medium text-foreground">
                {new Date(generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </span>
          )}
          {source && <span>via <span className="font-medium text-foreground">{sourceLabel}</span></span>}
          <span className="flex items-center gap-3">
            <ReadinessLegendDot strength="rich"   count={counts.rich} />
            <ReadinessLegendDot strength="usable" count={counts.usable} />
            <ReadinessLegendDot strength="thin"   count={counts.thin} />
            <ReadinessLegendDot strength="empty"  count={counts.empty} />
          </span>
        </div>
        {stale && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Inputs have changed since generation — regenerate from the top of the page to refresh.
          </div>
        )}
      </header>

      {/* Suggested read order */}
      <section className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Suggested first read
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {SUGGESTED_READ_ORDER.map((key, i) => (
            <span key={key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPickArtifact(key)}
                className="px-2 py-0.5 rounded border bg-background hover:bg-muted/50 transition-colors font-medium"
              >
                {ARTIFACT_LABEL_SHORT[key]}
              </button>
              {i < SUGGESTED_READ_ORDER.length - 1 && <span className="text-muted-foreground">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Audience bundles */}
      <div className="grid md:grid-cols-2 gap-4">
        {BUNDLES.map((bundle) => (
          <BundleCard key={bundle.label} bundle={bundle} project={project} onPick={onPickArtifact} />
        ))}
      </div>
    </div>
  );
}

async function copyScopedPack(project: OnboardingProject, scope: PackScope, label: string) {
  try {
    const md = assembleScopedPack(project, scope);
    await navigator.clipboard.writeText(md);
    toast.success(`${label} copied to clipboard`, { description: `${md.length.toLocaleString()} characters` });
  } catch {
    toast.error("Could not copy — clipboard access denied?");
  }
}

const SCOPE_FOR_BUNDLE: Record<string, PackScope | null> = {
  "Customer-Facing": "customer",
  "Internal": "internal",
  "Technical": "technical",
  "Product": null, // single artifact, no dedicated scope
};

function BundleCard({
  bundle, project, onPick,
}: {
  bundle: Bundle;
  project: OnboardingProject;
  onPick: (key: ArtifactKey) => void;
}) {
  const scope = SCOPE_FOR_BUNDLE[bundle.label];
  const readinesses = bundle.keys.map((k) => getArtifactReadiness(project, k));
  const rich = readinesses.filter((r) => r === "rich").length;
  const usable = readinesses.filter((r) => r === "usable").length;
  const thin = readinesses.filter((r) => r === "thin").length;
  const empty = readinesses.filter((r) => r === "empty").length;

  return (
    <article className={cn("rounded-lg border-2 p-4 space-y-3", bundle.accent)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{bundle.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{bundle.blurb}</p>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {bundle.keys.length} artifact{bundle.keys.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ul className="space-y-1">
        {bundle.keys.map((key) => {
          const r = getArtifactReadiness(project, key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onPick(key)}
                className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md hover:bg-background/70 transition-colors text-xs"
                title={`${READINESS_LABEL[r]} — click to open`}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", READINESS_DOT[r])} />
                <span className="font-medium truncate flex-1">{ARTIFACT_LABEL_SHORT[key]}</span>
                <span className="text-[10px] text-muted-foreground/70 shrink-0">{READINESS_LABEL[r]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
        {rich > 0 && <span>{rich} rich</span>}
        {usable > 0 && <span>· {usable} usable</span>}
        {thin > 0 && <span>· {thin} thin</span>}
        {empty > 0 && <span className="text-red-700">· {empty} empty</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPick(bundle.keys[0])}
          className="flex-1 text-xs font-medium px-3 py-1.5 rounded-md bg-foreground/90 text-background hover:bg-foreground transition-colors"
        >
          Read this pack →
        </button>
        {scope && (
          <button
            type="button"
            onClick={() => copyScopedPack(project, scope, bundle.label + " pack")}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted/50 transition-colors"
            title="Copy markdown to clipboard"
          >
            Copy
          </button>
        )}
      </div>
    </article>
  );
}

function ReadinessLegendDot({ strength, count }: { strength: ArtifactReadiness; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("w-1.5 h-1.5 rounded-full", READINESS_DOT[strength])} />
      <span>{count} {READINESS_LABEL[strength].toLowerCase()}</span>
    </span>
  );
}

// Short labels match the sidebar; kept here to avoid importing the full
// outputs page TabMeta table.
const ARTIFACT_LABEL_SHORT: Record<ArtifactKey, string> = {
  executiveSummary: "Executive Summary",
  customerDiscoverySummary: "Discovery Summary",
  currentStateWorkflow: "Current State Workflow",
  futureStateWorkflow: "Future State Workflow",
  requirementsMatrix: "Requirements Matrix",
  missingInformationLog: "Missing Info Log",
  integrationAndApiPlan: "Integration & API Plan",
  dataReadinessAssessment: "Data Readiness",
  implementationPlan: "Implementation Plan",
  riskRegisterSummary: "Risk Register Summary",
  pilotSuccessPlan: "Pilot Success Plan",
  stakeholderCommunicationPlan: "Comms Plan",
  engineeringHandoff: "Engineering Handoff",
  productFeedbackMemo: "Product Feedback Memo",
  nextActionsChecklist: "Next Actions",
};
