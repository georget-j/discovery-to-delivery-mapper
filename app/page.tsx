import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewProjectButton } from "@/components/NewProjectButton";

const PHASES = [
  {
    num: 1,
    label: "Discover",
    color: "border-blue-300 bg-blue-50 text-blue-800",
    blurb: "Capture context, stakeholders, notes",
  },
  {
    num: 2,
    label: "Design",
    color: "border-violet-300 bg-violet-50 text-violet-800",
    blurb: "Map workflows, systems, requirements",
  },
  {
    num: 3,
    label: "Plan",
    color: "border-amber-300 bg-amber-50 text-amber-800",
    blurb: "Surface risks, lock the pilot",
  },
  {
    num: 4,
    label: "Deliver",
    color: "border-emerald-300 bg-emerald-50 text-emerald-800",
    blurb: "Generate the 15-artifact pack",
  },
];

const OUTPUTS = [
  "Customer Discovery Summary",
  "Current & Future-State Workflow Map",
  "Requirements Matrix",
  "Missing Information Log",
  "Integration & API Plan",
  "Data Readiness Assessment",
  "Implementation Plan",
  "Deployment Risk Register",
  "Pilot Success Plan",
  "Engineering Handoff",
  "Stakeholder Communication Plan",
  "Product Feedback Memo",
  "Executive Summary",
  "Next Actions Checklist",
];

const AUDIENCES = [
  "Customer-facing engineering teams",
  "Solutions & delivery teams",
  "Pre-sales & onboarding teams",
  "Anyone turning discovery into delivery",
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16 space-y-16">
      {/* Hero */}
      <section className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Portfolio Project
          </Badge>
          <Badge variant="outline" className="text-xs">
            AI · B2B · Deployment
          </Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Discovery to Delivery Mapper
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Turn unstructured discovery into a structured delivery plan —
          requirements, risks, engineering handoffs, pilot success metrics, and
          more. For the teams who sit between customers and engineering, turning
          discovery calls into a plan engineering can build and customers can
          sign off.
        </p>
        <p className="text-xs text-muted-foreground/80">
          <span className="font-mono font-semibold text-foreground">15</span>{" "}
          deployment artifacts ·
          <span className="font-mono font-semibold text-foreground"> 4</span>{" "}
          phases ·
          <span className="font-mono font-semibold text-foreground"> 9</span>{" "}
          input categories
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link href="/scenarios" className={buttonVariants({ size: "lg" })}>
            Browse Scenarios
          </Link>
          {/* /workspace/custom has no backing project — mint a real one via
              the new-project modal instead of dead-linking. */}
          <NewProjectButton
            label="Start Custom Project"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          />
        </div>
      </section>

      {/* Journey pills */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          The 4-phase journey
        </h2>
        <div className="grid sm:grid-cols-4 gap-3">
          {PHASES.map((p) => (
            <div
              key={p.num}
              className={`rounded-lg border-2 px-4 py-3 ${p.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                  {p.num}
                </span>
                <span className="text-sm font-bold">{p.label}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-80">
                {p.blurb}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* What it generates */}
      <section className="grid md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Generated Outputs
          </h2>
          <ul className="space-y-2">
            {OUTPUTS.map((output, i) => (
              <li key={output} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 text-xs text-muted-foreground font-mono w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{output}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Who it&apos;s for
            </h2>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((audience) => (
                <Badge key={audience} variant="secondary" className="text-xs">
                  {audience}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-5 space-y-3">
            <h3 className="text-sm font-semibold">How It Works</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {[
                "Select a customer scenario or create your own",
                "Capture discovery inputs, workflow steps, and systems",
                "Auto-generate requirements and deployment risks",
                "Build a pilot success plan with KPIs and criteria",
                "Generate AI-structured implementation artifacts",
                "Export a complete Markdown onboarding pack",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border p-5 space-y-2">
            <h3 className="text-sm font-semibold">Why This Project Exists</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This project shows how teams that sit between customers and
              engineering can turn messy customer discovery into structured
              implementation artifacts — requirements, risks, pilot plans,
              engineering handoffs, and customer communications.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
