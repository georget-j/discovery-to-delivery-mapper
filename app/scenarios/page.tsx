import type { Metadata } from "next";
import { listScenarios, SCENARIO_META } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";
import { NewProjectButton } from "@/components/NewProjectButton";
import { LocalProjectsList } from "@/components/LocalProjectsList";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Scenarios · Discovery to Delivery Mapper",
  description: "Pick a pre-built customer scenario or start a blank project.",
};

export default function ScenariosPage() {
  // Recommended starter first — SCENARIO_META.sortOrder ranks by how soft a
  // landing each scenario gives a first-time visitor.
  const scenarios = [...listScenarios()].sort(
    (a, b) =>
      SCENARIO_META[a.scenarioType].sortOrder -
      SCENARIO_META[b.scenarioType].sortOrder,
  );
  const starter = scenarios.find((s) => SCENARIO_META[s.scenarioType].starter);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Customer Scenarios
          </h1>
          <p className="text-muted-foreground text-sm">
            Select a pre-built scenario to start a simulated onboarding
            workspace, or create a blank project to bring your own data.
          </p>
        </div>
        <NewProjectButton />
      </div>

      <LocalProjectsList />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Demo scenarios
        </h2>
        {starter && (
          <p className="text-sm text-muted-foreground">
            New here? Start with{" "}
            <span className="font-medium text-foreground">
              {starter.customer.companyName}
            </span>{" "}
            — the softest landing, ~
            {SCENARIO_META[starter.scenarioType].estimatedMinutes} min end to
            end.
          </p>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-5">
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="relative">
              {SCENARIO_META[scenario.scenarioType].starter && (
                <Badge className="absolute -top-2.5 left-4 z-10">
                  Start here
                </Badge>
              )}
              <ScenarioCard scenario={scenario} />
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-lg border bg-muted/30 p-5 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-xs uppercase tracking-wide">
          About these scenarios
        </p>
        <p>
          The demo scenarios above are fictional. Customer names, data, and
          situations are invented for demonstration purposes. Blank projects you
          create are stored locally in this browser only. AI features send
          project content to OpenAI.
        </p>
      </div>
    </div>
  );
}
