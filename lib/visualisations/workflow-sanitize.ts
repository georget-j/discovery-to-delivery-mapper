import { z } from "zod";
import {
  AIWorkflowNodeSchema,
  AIFutureWorkflowNodeSchema,
  WorkflowLaneSchema,
  WorkflowEdgeItemSchema,
  CurrentStateWorkflowMapAIResponseSchema,
  FutureStateAIWorkflowMapAIResponseSchema,
  type CurrentStateWorkflowMapAIResponse,
  type FutureStateAIWorkflowMapAIResponse,
  type CurrentStateWorkflowMap,
} from "./workflow-types";

// Referential-integrity repair for AI-generated workflow maps. Schema
// validation guarantees the shape; it cannot guarantee that edges point at
// real nodes, lane ids exist, node ids are unique, or that
// sourceCurrentStateNodeIds reference the actual current-state map. Models
// get all of these wrong occasionally, and React Flow renders the result as
// orphaned nodes / console errors / corrupt merges. Repairs are pure and
// reported, never silent.

export type SanitizeResult<M> = { map: M; repairs: string[] };

type MapShape = {
  projectId: string;
  lanes: { id: string; title: string; description?: string }[];
  nodes: {
    id: string;
    laneId: string;
    sourceCurrentStateNodeIds?: string[];
    [k: string]: unknown;
  }[];
  edges: { id: string; source: string; target: string; [k: string]: unknown }[];
};

function sanitizeCore<M extends MapShape>(
  map: M,
  projectId: string,
  currentStateNodeIds?: Set<string>,
): SanitizeResult<M> {
  const repairs: string[] = [];

  if (map.projectId !== projectId) {
    repairs.push(`projectId corrected from "${map.projectId}"`);
  }

  // Lanes: dedupe by id; a map with zero lanes gets one so laneId remapping
  // has a target and the canvas has somewhere to draw.
  const lanes: M["lanes"] = [];
  const laneIds = new Set<string>();
  for (const lane of map.lanes) {
    if (laneIds.has(lane.id)) {
      repairs.push(`duplicate lane "${lane.id}" dropped`);
      continue;
    }
    laneIds.add(lane.id);
    lanes.push(lane);
  }
  if (lanes.length === 0) {
    lanes.push({ id: "lane_main", title: "Workflow" });
    laneIds.add("lane_main");
    repairs.push("no lanes returned — default lane added");
  }
  const firstLaneId = lanes[0].id;

  // Nodes: unique ids (rename collisions), laneId must exist.
  const nodes: M["nodes"] = [];
  const nodeIds = new Set<string>();
  for (const node of map.nodes) {
    let id = node.id;
    if (nodeIds.has(id)) {
      let n = 2;
      while (nodeIds.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
      repairs.push(`duplicate node id "${node.id}" renamed to "${id}"`);
    }
    nodeIds.add(id);

    let laneId = node.laneId;
    if (!laneIds.has(laneId)) {
      repairs.push(
        `node "${id}" had unknown lane "${laneId}" — moved to "${firstLaneId}"`,
      );
      laneId = firstLaneId;
    }

    let sourceCurrentStateNodeIds = node.sourceCurrentStateNodeIds;
    if (sourceCurrentStateNodeIds && currentStateNodeIds) {
      const kept = sourceCurrentStateNodeIds.filter((s) =>
        currentStateNodeIds.has(s),
      );
      if (kept.length !== sourceCurrentStateNodeIds.length) {
        repairs.push(`node "${id}" referenced unknown current-state nodes`);
      }
      sourceCurrentStateNodeIds = kept;
    }

    nodes.push({
      ...node,
      id,
      laneId,
      ...(sourceCurrentStateNodeIds !== undefined
        ? { sourceCurrentStateNodeIds }
        : {}),
    });
  }

  // Edges: unique ids, endpoints must be real nodes.
  const edges: M["edges"] = [];
  const edgeIds = new Set<string>();
  for (const edge of map.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      repairs.push(`edge "${edge.id}" dropped (dangling endpoint)`);
      continue;
    }
    let id = edge.id;
    if (edgeIds.has(id)) {
      let n = 2;
      while (edgeIds.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
      repairs.push(`duplicate edge id "${edge.id}" renamed to "${id}"`);
    }
    edgeIds.add(id);
    edges.push({ ...edge, id });
  }

  return {
    map: { ...map, projectId, lanes, nodes, edges },
    repairs,
  };
}

export function sanitizeCurrentStateMap(
  map: CurrentStateWorkflowMapAIResponse,
  projectId: string,
): SanitizeResult<CurrentStateWorkflowMapAIResponse> {
  return sanitizeCore(map, projectId);
}

export function sanitizeFutureStateMap(
  map: FutureStateAIWorkflowMapAIResponse,
  projectId: string,
  currentMap?: Pick<CurrentStateWorkflowMap, "nodes"> | null,
): SanitizeResult<FutureStateAIWorkflowMapAIResponse> {
  const ids = currentMap
    ? new Set(currentMap.nodes.map((n) => n.id))
    : undefined;
  return sanitizeCore(map, projectId, ids);
}

// ── Salvage ─────────────────────────────────────────────────────────────────
// When whole-map validation fails even after the repair pass, try to keep the
// valid parts: parse lanes/nodes/edges item by item and drop the broken ones.
// A mostly-right AI map beats a generic template; below MIN_SALVAGE_NODES the
// result is too thin to be worth showing over the template.

export const MIN_SALVAGE_NODES = 4;

function salvageCore<S extends z.ZodTypeAny>(
  raw: unknown,
  nodeSchema: S,
  responseSchema: z.ZodTypeAny,
): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.title !== "string") return null;

  const lanes = Array.isArray(r.lanes)
    ? r.lanes.filter((l) => WorkflowLaneSchema.safeParse(l).success)
    : [];
  const nodes = Array.isArray(r.nodes)
    ? r.nodes
        .map((n) => nodeSchema.safeParse(n))
        .filter((p): p is z.SafeParseSuccess<z.infer<S>> => p.success)
        .map((p) => p.data)
    : [];
  if (lanes.length === 0 || nodes.length < MIN_SALVAGE_NODES) return null;

  const edges = Array.isArray(r.edges)
    ? r.edges.filter((e) => WorkflowEdgeItemSchema.safeParse(e).success)
    : [];

  const candidate = {
    ...r,
    lanes,
    nodes,
    edges,
    projectId: typeof r.projectId === "string" ? r.projectId : "",
  };
  const validated = responseSchema.safeParse(candidate);
  return validated.success ? validated.data : null;
}

export function salvageCurrentStateMap(
  raw: unknown,
): CurrentStateWorkflowMapAIResponse | null {
  return salvageCore(
    raw,
    AIWorkflowNodeSchema,
    CurrentStateWorkflowMapAIResponseSchema,
  ) as CurrentStateWorkflowMapAIResponse | null;
}

export function salvageFutureStateMap(
  raw: unknown,
): FutureStateAIWorkflowMapAIResponse | null {
  return salvageCore(
    raw,
    AIFutureWorkflowNodeSchema,
    FutureStateAIWorkflowMapAIResponseSchema,
  ) as FutureStateAIWorkflowMapAIResponse | null;
}
