"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OnboardingProject } from "@/lib/types";
import { SCENARIO_META } from "@/lib/scenarios";

type Props = { scenario: OnboardingProject };

const INDUSTRY_LABELS: Record<string, string> = {
  fintech: "Fintech",
  legaltech: "Legaltech",
  healthcare: "Healthcare",
  insurance: "Insurance",
  industrial: "Industrial",
  enterprise_saas: "Enterprise SaaS",
  public_sector: "Public Sector",
  other: "Other",
};

// Front face shows 3 things: industry, company name, primary use case. Extra
// detail (complexity, time, AI surfaces, risks, regulatory chips) collapsed
// behind a "Details" disclosure so the scenarios grid scans cleanly.
//
// Structure note: the Link wraps the title + use case (the primary action).
// The <details> sits OUTSIDE the Link so its summary toggle doesn't trigger
// navigation when expanding.
export function ScenarioCard({ scenario }: Props) {
  const meta = SCENARIO_META[scenario.scenarioType];
  const riskCount = scenario.risks.length;
  const systemCount = scenario.systems.length;
  const reg = scenario.customer.regulatoryContext;

  return (
    <Card className="h-full transition-shadow hover:shadow-md border-border hover:border-primary/30">
      <Link
        href={`/workspace/${scenario.id}`}
        className="block group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-t-xl"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {INDUSTRY_LABELS[scenario.customer.industry] ??
                  scenario.customer.industry}
              </p>
              <h3 className="font-semibold text-base mt-0.5 leading-snug group-hover:text-primary transition-colors">
                {scenario.customer.companyName}
              </h3>
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs shrink-0", meta.color)}
            >
              {meta.complexity}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed line-clamp-2">
            {scenario.customer.primaryUseCase}
          </p>
        </CardContent>
      </Link>
      <details className="group/details border-t mx-4 pt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 list-none select-none">
          <span className="group-open/details:hidden">Show details</span>
          <span className="hidden group-open/details:inline">Hide details</span>
          <span
            aria-hidden
            className="group-open/details:rotate-90 transition-transform"
          >
            ▸
          </span>
        </summary>
        <div className="pt-2 pb-3 space-y-2 text-xs text-muted-foreground">
          <p className="leading-relaxed">{scenario.customer.businessProblem}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span aria-hidden>⏱</span>~{meta.estimatedMinutes} min walkthrough
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden>🤖</span>
              {meta.aiSurfaces} AI surface{meta.aiSurfaces !== 1 ? "s" : ""}
            </span>
            <span className="col-span-2 flex items-center gap-1 text-foreground/80">
              <span aria-hidden>🎯</span>
              <span className="truncate">Best for: {meta.bestFor}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              {riskCount} risks
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
              {systemCount} systems
            </span>
            <span className="flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
              <span className="truncate">
                {reg.length > 0 ? reg.join(", ") : "No regulatory context"}
              </span>
            </span>
          </div>
        </div>
      </details>
    </Card>
  );
}
