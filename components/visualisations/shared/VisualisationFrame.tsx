"use client";

import { ReactNode, useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Surface } from "@/components/ui/surface";
import {
  SaveIndicator,
  useSaveIndicator,
} from "@/components/ui/save-indicator";

type Props = {
  title: string;
  subtitle?: string;
  titleBadge?: ReactNode; // small badge in the title row (e.g. SourceBadge)
  toolbar?: ReactNode;
  banner?: ReactNode; // sits between title row and canvas (e.g. StaleBanner)
  canvas: ReactNode;
  inspector?: ReactNode;
  // Optional "Suggestions" rail shown in the right column. When both inspector
  // and rail are provided, a segmented toggle switches between them; the rail
  // is the default when no node is selected.
  rail?: ReactNode;
  // Optional guided walkthrough panel. When `walkthroughOpen` is true it takes
  // over the right column (replacing the rail/inspector toggle) until closed.
  walkthrough?: ReactNode;
  walkthroughOpen?: boolean;
  legend?: ReactNode;
  // Mobile-only: controls whether the inspector renders open in its bottom-sheet.
  // Typically wired to !!selectedNodeId by the consumer.
  inspectorOpen?: boolean;
  onInspectorOpenChange?: (next: boolean) => void;
  // Optional `updatedAt` from the underlying map. When it changes, the title
  // row briefly flashes "Saved" so the user knows their drag persisted.
  lastSavedAt?: string;
};

export function VisualisationFrame({
  title,
  subtitle,
  titleBadge,
  toolbar,
  banner,
  canvas,
  inspector,
  rail,
  walkthrough,
  walkthroughOpen = false,
  legend,
  inspectorOpen = false,
  onInspectorOpenChange,
  lastSavedAt,
}: Props) {
  const [toolsOpen, setToolsOpen] = useState(false);
  // Which right-column panel is showing. Selecting a node flips to the
  // inspector; deselecting returns to the suggestions rail.
  const [rightPanel, setRightPanel] = useState<"inspector" | "rail">("rail");
  const saveState = useSaveIndicator(lastSavedAt);
  useEffect(() => {
    setRightPanel(inspectorOpen ? "inspector" : "rail");
  }, [inspectorOpen]);

  const activePanel: "inspector" | "rail" | null =
    rightPanel === "inspector" && inspector
      ? "inspector"
      : rail
        ? "rail"
        : inspector
          ? "inspector"
          : null;

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3 flex-wrap sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {titleBadge}
            {lastSavedAt && saveState === "saved" && (
              <SaveIndicator state={saveState} />
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
        {toolbar && (
          <>
            {/* Desktop: toolbar inline */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {toolbar}
            </div>
            {/* Mobile: hamburger that opens the toolbar in a bottom Sheet */}
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="md:hidden text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors shrink-0"
            >
              Tools ▾
            </button>
          </>
        )}
      </div>

      {banner && (
        <div className="border-b px-4 py-2 bg-amber-50/50">{banner}</div>
      )}

      <div
        className="relative flex"
        style={{ height: "min(640px, calc(100dvh - 14rem))" }}
      >
        <div className="flex-1 relative bg-muted/10">{canvas}</div>
        {(inspector || rail || walkthrough) && (
          <div className="hidden md:flex flex-col w-72 shrink-0 border-l bg-background">
            {walkthroughOpen && walkthrough ? (
              // Guided walkthrough takes over the whole column until closed.
              <div className="flex-1 overflow-hidden">{walkthrough}</div>
            ) : (
              <>
                {inspector && rail && (
                  <div className="flex items-center gap-0.5 p-1 border-b shrink-0">
                    {(["rail", "inspector"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRightPanel(p)}
                        className={
                          "flex-1 text-[11px] px-2 py-1 rounded transition-colors " +
                          (activePanel === p
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        {p === "rail" ? "✨ Suggestions" : "Inspector"}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto">
                  {activePanel === "rail" ? rail : inspector}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {legend && (
        <div className="border-t bg-muted/20 px-4 py-2 hidden md:block">
          {legend}
        </div>
      )}

      {/* Mobile inspector — bottom sheet */}
      {inspector && onInspectorOpenChange && (
        <Sheet
          open={inspectorOpen}
          onOpenChange={onInspectorOpenChange}
          side="bottom"
          ariaLabel="Node inspector"
          className="md:hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Inspector</p>
            <button
              type="button"
              onClick={() => onInspectorOpenChange(false)}
              className="text-xs px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Close inspector"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            {inspector}
          </div>
        </Sheet>
      )}

      {/* Mobile toolbar — bottom sheet */}
      {toolbar && (
        <Sheet
          open={toolsOpen}
          onOpenChange={setToolsOpen}
          side="bottom"
          ariaLabel="Canvas tools"
          className="md:hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Tools</p>
            <button
              type="button"
              onClick={() => setToolsOpen(false)}
              className="text-xs px-2 py-1 rounded hover:bg-muted/50"
              aria-label="Close tools"
            >
              ✕
            </button>
          </div>
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-wrap gap-2">
            {toolbar}
          </div>
          {legend && (
            <div className="border-t bg-muted/20 px-4 py-3">{legend}</div>
          )}
        </Sheet>
      )}
    </Surface>
  );
}
