"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Sheet } from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/use-media-query";
import {
  previewArtifact,
  type ArtifactPreviewKey,
} from "@/lib/artifact-templates";
import { cn } from "@/lib/utils";

type Props = {
  /** Which artifacts to show in the preview rail. */
  artifacts?: ArtifactPreviewKey[];
  className?: string;
};

const DEFAULT_KEYS: ArtifactPreviewKey[] = [
  "executiveSummary",
  "customerDiscoverySummary",
  "pilotSuccessPlan",
];

const LABEL: Record<ArtifactPreviewKey, string> = {
  executiveSummary: "Executive Summary",
  customerDiscoverySummary: "Discovery Summary",
  currentStateWorkflow: "Current Workflow",
  futureStateWorkflow: "Future Workflow",
  requirementsMatrix: "Requirements",
  missingInformationLog: "Missing Info",
  integrationAndApiPlan: "Integration Plan",
  dataReadinessAssessment: "Data Readiness",
  implementationPlan: "Implementation",
  riskRegisterSummary: "Risk Register",
  pilotSuccessPlan: "Pilot Plan",
  stakeholderCommunicationPlan: "Comms Plan",
  engineeringHandoff: "Engineering",
  productFeedbackMemo: "Product Feedback",
  nextActionsChecklist: "Next Actions",
};

// Right-rail preview that re-renders any of the 15 artifacts directly from
// the project state, no API call. Makes the input→output link visible in
// real time as the user types. On mobile, opens as a bottom Sheet instead.
export function LiveArtifactPreview({
  artifacts = DEFAULT_KEYS,
  className,
}: Props) {
  const { project } = useWorkspace();
  const isMobile = useIsMobile();
  const [activeKey, setActiveKey] = useState<ArtifactPreviewKey>(artifacts[0]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const markdown = useMemo(() => {
    if (!project) return "";
    return previewArtifact(project, activeKey);
  }, [project, activeKey]);

  if (!project) return null;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-20 right-3 z-30 text-xs px-3 py-2 rounded-full border border-border bg-background shadow-md hover:bg-muted/50 transition-colors"
          aria-label="Open live artifact preview"
        >
          👁 Preview
        </button>
        <Sheet
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          side="bottom"
          ariaLabel="Live artifact preview"
        >
          <div className="bg-background rounded-t-lg max-h-[80vh] overflow-hidden flex flex-col">
            <PreviewHeader
              artifacts={artifacts}
              activeKey={activeKey}
              onPick={setActiveKey}
            />
            <PreviewBody markdown={markdown} />
          </div>
        </Sheet>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-l bg-muted/10 transition-all",
        collapsed ? "w-10" : "w-80",
        className,
      )}
      aria-label="Live artifact preview"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="h-full w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand preview"
        >
          <span className="block rotate-180 [writing-mode:vertical-rl] py-2">
            👁 Live preview
          </span>
        </button>
      ) : (
        <>
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Live preview
            </p>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Collapse preview"
            >
              ⇥
            </button>
          </div>
          <PreviewHeader
            artifacts={artifacts}
            activeKey={activeKey}
            onPick={setActiveKey}
          />
          <PreviewBody markdown={markdown} />
        </>
      )}
    </aside>
  );
}

function PreviewHeader({
  artifacts,
  activeKey,
  onPick,
}: {
  artifacts: ArtifactPreviewKey[];
  activeKey: ArtifactPreviewKey;
  onPick: (k: ArtifactPreviewKey) => void;
}) {
  return (
    <div className="px-3 py-2 border-b flex items-center gap-1 overflow-x-auto">
      {artifacts.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onPick(k)}
          className={cn(
            "shrink-0 text-[10px] px-2 py-1 rounded-md border transition-colors",
            k === activeKey
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function PreviewBody({ markdown }: { markdown: string }) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="prose prose-sm max-w-none text-xs leading-relaxed">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
      <p className="text-[10px] text-muted-foreground/60 italic mt-3 pt-3 border-t">
        Template preview — full pack regenerates via Outputs tab.
      </p>
    </div>
  );
}
