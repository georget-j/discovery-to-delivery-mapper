import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function ScenarioCard({ scenario }: Props) {
  const meta = SCENARIO_META[scenario.scenarioType];
  const riskCount = scenario.risks.length;
  const systemCount = scenario.systems.length;

  return (
    <Link href={`/workspace/${scenario.id}`} className="block group">
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer border-border group-hover:border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {INDUSTRY_LABELS[scenario.customer.industry] ??
                  scenario.customer.industry}
              </p>
              <h3 className="font-semibold text-base mt-0.5 leading-snug">
                {scenario.customer.companyName}
              </h3>
            </div>
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${meta.color}`}
            >
              {meta.complexity}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {scenario.customer.primaryUseCase}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {scenario.customer.businessProblem}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span aria-hidden>⏱</span>~{meta.estimatedMinutes} min walkthrough
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden>🤖</span>
              {meta.aiSurfaces} AI surface{meta.aiSurfaces !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 col-span-2 text-foreground/80">
              <span aria-hidden>🎯</span>
              <span className="truncate">Best for: {meta.bestFor}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground border-t pt-2 mt-1">
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
                {scenario.customer.regulatoryContext.length > 0
                  ? scenario.customer.regulatoryContext.join(", ")
                  : "No regulatory context"}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
