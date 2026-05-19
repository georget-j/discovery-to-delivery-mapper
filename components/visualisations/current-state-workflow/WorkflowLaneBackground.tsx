"use client";

import { useViewport } from "@xyflow/react";
import type { WorkflowLane } from "@/lib/visualisations/workflow-types";

type Props = {
  lanes: WorkflowLane[];
  laneYs: Record<string, number>;
  laneHeight?: number;
  width?: number;
};

// Renders horizontal swimlane bands inside the React Flow canvas. Reads the
// current viewport transform so the lanes pan and zoom WITH the nodes — without
// useViewport(), the lanes would stay still while the canvas moves and the
// nodes would visually fall out of their lanes.
export function WorkflowLaneBackground({ lanes, laneYs, laneHeight = 160, width = 2800 }: Props) {
  const { x, y, zoom } = useViewport();

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {lanes.map((lane, i) => {
          const laneY = laneYs[lane.id] ?? i * laneHeight;
          const isOdd = i % 2 === 1;
          return (
            <div
              key={lane.id}
              className={isOdd ? "absolute bg-muted/40" : "absolute bg-muted/15"}
              style={{
                top: laneY - 40,
                left: -800,
                width: width + 1600,
                height: laneHeight,
              }}
            />
          );
        })}
      </div>

      {/* Lane labels stay fixed on the left edge regardless of pan/zoom so the
          user always knows which lane is which. */}
      <div className="absolute top-0 left-0 bottom-0 w-32 pointer-events-none">
        {lanes.map((lane, i) => {
          const laneY = laneYs[lane.id] ?? i * laneHeight;
          // Project the lane's canvas y into screen-space (apply pan + zoom).
          const screenY = laneY * zoom + y;
          return (
            <div
              key={lane.id}
              className="absolute left-3 px-2 py-1 rounded bg-background/90 border border-border/60 backdrop-blur-sm shadow-sm"
              style={{ top: screenY - 14 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {lane.title}
              </p>
              {lane.description && (
                <p className="text-[9px] text-muted-foreground/70 leading-tight">
                  {lane.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
