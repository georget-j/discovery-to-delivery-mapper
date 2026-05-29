"use client";

import { use, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { loadProject } from "@/lib/project-store";
import { loadScenario } from "@/lib/scenarios";
import { assembleScopedPack } from "@/lib/markdown-export";
import type { PackScope } from "@/lib/markdown-export";
import type { OnboardingProject } from "@/lib/types";

// Print-optimised, layout-free view of the deployment pack. Opened in a new
// tab from the Outputs page with ?scope=customer|internal|technical|full and
// ?auto=1 to auto-trigger the browser print dialog. Print-isolation CSS hides
// the global app chrome so "Save as PDF" produces a clean document.
export default function PrintPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<OnboardingProject | null>(null);
  const [scope, setScope] = useState<PackScope>("full");
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    setProject(loadProject(id) ?? loadScenario(id));
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("scope");
    if (
      s === "customer" ||
      s === "internal" ||
      s === "technical" ||
      s === "full"
    ) {
      setScope(s);
    }
    setAuto(sp.get("auto") === "1");
  }, [id]);

  const markdown = useMemo(
    () => (project ? assembleScopedPack(project, scope) : ""),
    [project, scope],
  );

  // Auto-open the print dialog once content has painted.
  useEffect(() => {
    if (!auto || !project) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [auto, project]);

  if (!project) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading pack… If this persists, generate the pack on the Outputs tab
        first.
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-root, #print-root * { visibility: visible; }
          #print-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { margin: 18mm 16mm; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-3 border-b bg-background/95 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          Print preview — {project.customer.companyName || project.name}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          Print / Save as PDF
        </button>
      </div>

      <div
        id="print-root"
        className="mx-auto max-w-3xl px-8 py-10 prose prose-sm max-w-none text-foreground [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:pb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:border-b [&_th]:border-foreground/30 [&_th]:py-1.5 [&_td]:py-1.5 [&_td]:align-top [&_tr]:border-b [&_tr]:border-border [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_ul]:space-y-1 [&_li]:leading-relaxed [&_hr]:my-6 [&_hr]:border-border"
      >
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </>
  );
}
