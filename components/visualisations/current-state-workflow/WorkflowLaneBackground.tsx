"use client";

import type { WorkflowLane } from "@/lib/visualisations/workflow-types";

type Props = {
  lanes: WorkflowLane[];
  laneYs: Record<string, number>;
  laneHeight?: number;
  width?: number;
};

// Renders horizontal swimlane bands as an absolutely-positioned background behind
// the React Flow canvas. React Flow renders into a panning viewport so we render
// the lanes inside React Flow's <Background> slot — but for simplicity we render
// them as a separate absolutely-positioned layer matching the same coordinate space.
// React Flow exposes its current transform via the useViewport hook; we apply it.
export function WorkflowLaneBackground({ lanes, laneYs, laneHeight = 160, width = 2400 }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {lanes.map((lane, i) => {
        const y = laneYs[lane.id] ?? i * laneHeight;
        const isOdd = i % 2 === 1;
        return (
          <div
            key={lane.id}
            className={isOdd ? "absolute bg-muted/30" : "absolute bg-muted/10"}
            style={{
              top: y - 40,
              left: 0,
              width,
              height: laneHeight,
            }}
          >
            <div className="absolute left-3 top-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              {lane.title}
            </div>
            {lane.description && (
              <div className="absolute left-3 top-9 text-[10px] text-muted-foreground/60">
                {lane.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
