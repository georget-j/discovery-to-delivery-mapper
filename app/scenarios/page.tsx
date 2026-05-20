import type { Metadata } from "next";
import { listScenarios } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Scenarios · Onboarding Simulator",
  description: "Pick a pre-built customer scenario or start a blank project.",
};

export default function ScenariosPage() {
  const scenarios = listScenarios();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Customer Scenarios</h1>
          <p className="text-muted-foreground text-sm">
            Select a pre-built scenario to start a simulated onboarding workspace, or create a blank project.
          </p>
        </div>
        <Link href="/workspace/custom" className={buttonVariants({ variant: "outline" })}>
          Start Blank Project
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-5">
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>

      <div className="rounded-lg border bg-muted/30 p-5 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-xs uppercase tracking-wide">About these scenarios</p>
        <p>
          All scenarios are fictional. Customer names, data, and situations are invented for demonstration purposes.
          Each scenario is pre-seeded with realistic discovery data, workflows, systems, stakeholders, risks, and a pilot plan.
        </p>
      </div>
    </div>
  );
}
