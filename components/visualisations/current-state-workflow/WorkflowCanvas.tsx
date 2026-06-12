"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  PanOnScrollMode,
  SelectionMode,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeChange,
  type EdgeChange,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  CurrentStateWorkflowMap,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/visualisations/workflow-types";
import { WorkflowNode as WorkflowNodeComp } from "./WorkflowNode";
import { WorkflowLaneBackground } from "./WorkflowLaneBackground";
import {
  mapToReactFlowNodes,
  mapToReactFlowEdges,
  CURRENT_LANE_Y,
  laneIdForY,
} from "./workflowUtils";
import { MapEditProvider } from "../shared/MapEditContext";
import {
  CanvasContextMenu,
  type ContextMenuItem,
} from "../shared/CanvasContextMenu";

const NODE_TYPES = { workflow: WorkflowNodeComp };

type Props = {
  map: CurrentStateWorkflowMap;
  onChange: (next: CurrentStateWorkflowMap) => void;
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
  onMultiSelectChange?: (ids: string[]) => void;
  onNodeContextMenu?: (nodeId: string, x: number, y: number) => void;
  onPaneContextMenu?: (
    x: number,
    y: number,
    flowPosition: { x: number; y: number },
  ) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
};

function CanvasInner({
  map,
  onChange,
  onSelectNode,
  selectedNodeId,
  onMultiSelectChange,
  onNodeContextMenu,
  onPaneContextMenu,
  onDuplicateNode,
  onDeleteNode,
}: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const initialNodes = useMemo(() => mapToReactFlowNodes(map), [map]);
  const initialEdges = useMemo(() => mapToReactFlowEdges(map), [map]);

  // Lane bands must cover the rightmost node — wide maps (15+ columns) ran
  // past the old hardcoded band width and nodes floated on blank background.
  const laneWidth = useMemo(
    () => Math.max(2800, ...map.nodes.map((n) => n.position.x + 240)),
    [map.nodes],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>(initialEdges);

  useMemo(() => {
    setNodes(mapToReactFlowNodes(map));
    setEdges(mapToReactFlowEdges(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, map.updatedAt]);

  const patchNode = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      onChange({
        ...map,
        nodes: map.nodes.map((n) =>
          n.id === id ? ({ ...n, ...patch } as WorkflowNode) : n,
        ),
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [map, onChange],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Multi-select tracking
      const selectChanges = changes.filter((c) => c.type === "select");
      if (selectChanges.length > 0 && onMultiSelectChange) {
        // Compute current selection from the rf state after this batch
        setTimeout(() => {
          setNodes((curr) => {
            const ids = curr.filter((n) => n.selected).map((n) => n.id);
            onMultiSelectChange(ids);
            return curr;
          });
        }, 0);
      }

      const positionChanges = changes.filter(
        (c) => c.type === "position" && !("dragging" in c && c.dragging),
      );
      const removeChanges = changes.filter((c) => c.type === "remove");
      if (positionChanges.length === 0 && removeChanges.length === 0) return;

      const updatedNodes: WorkflowNode[] = map.nodes.flatMap((n) => {
        if (removeChanges.some((c) => "id" in c && c.id === n.id)) return [];
        const move = positionChanges.find(
          (c) => "id" in c && c.id === n.id && "position" in c,
        );
        if (move && "position" in move && move.position) {
          return [
            {
              ...n,
              position: move.position,
              laneId: laneIdForY(move.position.y, map.lanes),
            },
          ];
        }
        return [n];
      });

      const removedIds = new Set(
        removeChanges
          .filter((c) => "id" in c)
          .map((c) => (c as { id: string }).id),
      );
      const updatedEdges: WorkflowEdge[] = map.edges.filter(
        (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
      );

      onChange({
        ...map,
        nodes: updatedNodes,
        edges: updatedEdges,
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [onNodesChange, map, onChange, onMultiSelectChange, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      const removeChanges = changes.filter((c) => c.type === "remove");
      if (removeChanges.length === 0) return;
      const removedIds = new Set(
        removeChanges
          .filter((c) => "id" in c)
          .map((c) => (c as { id: string }).id),
      );
      const updatedEdges = map.edges.filter((e) => !removedIds.has(e.id));
      onChange({
        ...map,
        edges: updatedEdges,
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [onEdgesChange, map, onChange],
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds));
      const newEdge: WorkflowEdge = {
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        source: params.source,
        target: params.target,
        style: "solid",
      };
      onChange({
        ...map,
        edges: [...map.edges, newEdge],
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [setEdges, map, onChange],
  );

  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: RFNode) => onSelectNode(node.id),
    [onSelectNode],
  );

  const handlePaneClick = useCallback(() => onSelectNode(null), [onSelectNode]);

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: RFNode) => {
      e.preventDefault();
      onSelectNode(node.id);
      onNodeContextMenu?.(node.id, e.clientX, e.clientY);
    },
    [onSelectNode, onNodeContextMenu],
  );

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const { clientX, clientY } = e as MouseEvent;
      onPaneContextMenu?.(
        clientX,
        clientY,
        screenToFlowPosition({ x: clientX, y: clientY }),
      );
    },
    [onPaneContextMenu, screenToFlowPosition],
  );

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId || n.selected,
      })),
    [nodes, selectedNodeId],
  );

  return (
    <MapEditProvider
      value={{
        patchNode,
        duplicateNode: onDuplicateNode,
        deleteNode: onDeleteNode,
      }}
    >
      <div className="absolute inset-0">
        <WorkflowLaneBackground
          lanes={map.lanes}
          laneYs={CURRENT_LANE_Y}
          width={laneWidth}
        />
        <ReactFlow
          nodes={nodesWithSelection}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          className="dtdm-flow"
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode={["Meta", "Shift", "Control"]}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll={false}
          // Holding either modifier turns scroll into zoom (panOnScroll yields
          // while a zoom-activation key is pressed).
          zoomActivationKeyCode={["Meta", "Control"]}
          zoomOnPinch
          nodeDragThreshold={4}
          defaultEdgeOptions={{ type: "smoothstep" }}
          snapToGrid
          snapGrid={[12, 12]}
        >
          <Background gap={20} size={1} color="#e2e8f0" />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor={(n) => {
              const data = n.data as unknown as WorkflowNode | undefined;
              switch (data?.type) {
                case "human_step":
                  return "#93c5fd";
                case "system_step":
                  return "#6ee7b7";
                case "decision":
                  return "#fcd34d";
                case "risk":
                  return "#fca5a5";
                case "missing_info":
                  return "#fdba74";
                default:
                  return "#cbd5e1";
              }
            }}
            maskColor="rgba(248, 250, 252, 0.7)"
          />
          <ReFitOnOrientation />
        </ReactFlow>
      </div>
    </MapEditProvider>
  );
}

// Re-fits the viewport when the device rotates or the window resizes past
// a meaningful threshold. The initial `fitView` prop handles first mount;
// this covers the mobile-rotation case where the canvas would otherwise
// strand the graph off-screen.
function ReFitOnOrientation() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (typeof window === "undefined") return;
    let pending = false;
    const refit = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fitView({ padding: 0.15, maxZoom: 1, duration: 200 });
      });
    };
    window.addEventListener("orientationchange", refit);
    window.addEventListener("resize", refit);
    return () => {
      window.removeEventListener("orientationchange", refit);
      window.removeEventListener("resize", refit);
    };
  }, [fitView]);
  return null;
}

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// Re-export so orchestrators can use ContextMenuItem
export type { ContextMenuItem };
export { CanvasContextMenu };
