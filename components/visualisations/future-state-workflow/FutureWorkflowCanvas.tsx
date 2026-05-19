"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeChange,
  type EdgeChange,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { FutureStateAIWorkflowMap, FutureWorkflowNode, WorkflowEdge } from "@/lib/visualisations/workflow-types";
import { FutureWorkflowNode as FutureWorkflowNodeComp } from "./FutureWorkflowNode";
import { WorkflowLaneBackground } from "../current-state-workflow/WorkflowLaneBackground";
import { mapToReactFlowNodes, mapToReactFlowEdges, FUTURE_LANE_Y, laneIdForY } from "./futureWorkflowUtils";

const NODE_TYPES = { future_workflow: FutureWorkflowNodeComp };

type Props = {
  map: FutureStateAIWorkflowMap;
  onChange: (next: FutureStateAIWorkflowMap) => void;
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
};

function CanvasInner({ map, onChange, onSelectNode, selectedNodeId }: Props) {
  const initialNodes = useMemo(() => mapToReactFlowNodes(map), [map]);
  const initialEdges = useMemo(() => mapToReactFlowEdges(map), [map]);

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>(initialEdges);

  useMemo(() => {
    setNodes(mapToReactFlowNodes(map));
    setEdges(mapToReactFlowEdges(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, map.updatedAt]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const positionChanges = changes.filter((c) => c.type === "position" && !("dragging" in c && c.dragging));
      const removeChanges = changes.filter((c) => c.type === "remove");
      if (positionChanges.length === 0 && removeChanges.length === 0) return;

      const updatedNodes: FutureWorkflowNode[] = map.nodes.flatMap((n) => {
        if (removeChanges.some((c) => "id" in c && c.id === n.id)) return [];
        const move = positionChanges.find((c) => "id" in c && c.id === n.id && "position" in c);
        if (move && "position" in move && move.position) {
          return [{
            ...n,
            position: move.position,
            laneId: laneIdForY(move.position.y, map.lanes),
          }];
        }
        return [n];
      });

      const removedIds = new Set(removeChanges.filter((c) => "id" in c).map((c) => (c as { id: string }).id));
      const updatedEdges: WorkflowEdge[] = map.edges.filter(
        (e) => !removedIds.has(e.source) && !removedIds.has(e.target)
      );

      onChange({
        ...map,
        nodes: updatedNodes,
        edges: updatedEdges,
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [onNodesChange, map, onChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      const removeChanges = changes.filter((c) => c.type === "remove");
      if (removeChanges.length === 0) return;
      const removedIds = new Set(removeChanges.filter((c) => "id" in c).map((c) => (c as { id: string }).id));
      const updatedEdges = map.edges.filter((e) => !removedIds.has(e.id));
      onChange({
        ...map,
        edges: updatedEdges,
        source: "manual",
        updatedAt: new Date().toISOString(),
      });
    },
    [onEdgesChange, map, onChange]
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
    [setEdges, map, onChange]
  );

  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: RFNode) => onSelectNode(node.id),
    [onSelectNode]
  );

  const handlePaneClick = useCallback(() => onSelectNode(null), [onSelectNode]);

  const nodesWithSelection = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId })),
    [nodes, selectedNodeId]
  );

  return (
    <div className="absolute inset-0">
      <WorkflowLaneBackground lanes={map.lanes} laneYs={FUTURE_LANE_Y} />
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function FutureWorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
