// Semantic "Review & tidy" for the future-state AI workflow map.
//
// Geometric auto-layout (auto-layout.ts) only moves nodes around. This module
// looks at the *meaning* of the graph and surfaces findings the user confirms
// before anything changes:
//   • orphan      — a node with no edges in or out (e.g. a stray AI node)
//   • duplicate   — two+ same-type nodes doing the same job (similar titles)
//   • redundant   — more than one monitoring / audit-log layer
// Plus pure merge/remove helpers that the panel applies on confirm. An LLM
// "semantic pass" (/api/review/workflow) adds fuzzy "same job, different name"
// findings on top of these deterministic rules.

import type {
  FutureStateAIWorkflowMap,
  FutureWorkflowNode,
  FutureWorkflowNodeType,
  WorkflowEdge,
} from "@/lib/visualisations/workflow-types";

export type ReviewFindingKind =
  | "orphan"
  | "duplicate"
  | "redundant"
  | "misplaced";

export type ReviewAction = "merge" | "remove" | "keep";

export type ReviewFinding = {
  id: string;
  kind: ReviewFindingKind;
  nodeIds: string[]; // the nodes this finding is about
  title: string; // short human summary
  reason: string; // why it was flagged
  defaultAction: ReviewAction;
  keepId?: string; // for "merge": the survivor
  source: "rule" | "ai";
};

// ── Similarity ──────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "node",
  "step",
  "new",
  "this",
  "that",
  "from",
  "into",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function nodeText(n: FutureWorkflowNode): string {
  return `${n.title} ${n.aiRole ?? ""} ${n.description ?? ""}`;
}

export function nodeSimilarity(
  a: FutureWorkflowNode,
  b: FutureWorkflowNode,
): number {
  return jaccard(tokens(nodeText(a)), tokens(nodeText(b)));
}

const DUPLICATE_THRESHOLD = 0.5;

// ── Detection ─────────────────────────────────────────────────────────────

function degree(map: FutureStateAIWorkflowMap): Map<string, number> {
  const deg = new Map<string, number>();
  for (const n of map.nodes) deg.set(n.id, 0);
  for (const e of map.edges) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }
  return deg;
}

// Union-find for clustering near-duplicate nodes within a type.
function cluster(ids: string[], related: (a: string, b: string) => boolean) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (related(ids[i], ids[j])) union(ids[i], ids[j]);
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const g = groups.get(root) ?? [];
    g.push(id);
    groups.set(root, g);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

export function detectFindings(map: FutureStateAIWorkflowMap): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const deg = degree(map);
  const title = (id: string) => byId.get(id)?.title ?? id;

  // 1 — Orphans. Only meaningful once the map has at least one edge (a fully
  // unconnected freshly-generated map isn't "stray nodes", it just isn't wired
  // yet). A 1-node map has nothing to connect to.
  if (map.edges.length > 0 && map.nodes.length > 1) {
    for (const n of map.nodes) {
      if ((deg.get(n.id) ?? 0) === 0) {
        findings.push({
          id: `orphan:${n.id}`,
          kind: "orphan",
          nodeIds: [n.id],
          title: `"${n.title}" isn't connected to anything`,
          reason:
            "This node has no incoming or outgoing edges — it looks like it was added but never wired into the flow.",
          defaultAction: "remove",
          source: "rule",
        });
      }
    }
  }

  // 2 — Near-duplicates within a node type (copies / very similar titles).
  const byType = new Map<FutureWorkflowNodeType, FutureWorkflowNode[]>();
  for (const n of map.nodes) {
    const list = byType.get(n.type) ?? [];
    list.push(n);
    byType.set(n.type, list);
  }
  for (const [, group] of byType) {
    if (group.length < 2) continue;
    const ids = group.map((n) => n.id);
    const clusters = cluster(
      ids,
      (a, b) =>
        nodeSimilarity(byId.get(a)!, byId.get(b)!) >= DUPLICATE_THRESHOLD,
    );
    for (const c of clusters) {
      // Keep the best-connected node as the survivor.
      const keepId = [...c].sort(
        (a, b) => (deg.get(b) ?? 0) - (deg.get(a) ?? 0),
      )[0];
      findings.push({
        id: `dup:${[...c].sort().join("_")}`,
        kind: "duplicate",
        nodeIds: c,
        title: `${c.length} nodes look like duplicates`,
        reason: `${c
          .map(title)
          .map((t) => `"${t}"`)
          .join(
            ", ",
          )} are the same type with near-identical descriptions — they may be doing the same job.`,
        defaultAction: "merge",
        keepId,
        source: "rule",
      });
    }
  }

  // 3 — Redundant operational layers: more than one monitoring or audit_log.
  for (const t of ["monitoring", "audit_log"] as FutureWorkflowNodeType[]) {
    const ids = (byType.get(t) ?? []).map((n) => n.id);
    if (ids.length > 1) {
      // Skip if a duplicate finding already covers exactly these nodes.
      const key = [...ids].sort().join("_");
      if (findings.some((f) => [...f.nodeIds].sort().join("_") === key))
        continue;
      const keepId = [...ids].sort(
        (a, b) => (deg.get(b) ?? 0) - (deg.get(a) ?? 0),
      )[0];
      findings.push({
        id: `redundant:${t}`,
        kind: "redundant",
        nodeIds: ids,
        title: `${ids.length} ${t === "audit_log" ? "audit logs" : "monitoring nodes"}`,
        reason: `A workflow usually needs one ${t === "audit_log" ? "audit log" : "monitoring layer"}. Merge them into a single node.`,
        defaultAction: "merge",
        keepId,
        source: "rule",
      });
    }
  }

  return findings;
}

// ── Mutations (pure) ─────────────────────────────────────────────────────────

function unionArrays(a?: string[], b?: string[]): string[] | undefined {
  if (!a && !b) return undefined;
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

// Merge dropIds into keepId: rewire every edge that touches a dropped node onto
// the survivor (dropping self-loops + duplicate edges, preserving labels), and
// union the survivor's array fields with the dropped nodes'.
export function mergeNodes(
  map: FutureStateAIWorkflowMap,
  keepId: string,
  dropIds: string[],
): FutureStateAIWorkflowMap {
  const drop = new Set(dropIds.filter((id) => id !== keepId));
  if (drop.size === 0) return map;
  const remap = (id: string) => (drop.has(id) ? keepId : id);

  const seen = new Set<string>();
  const edges: WorkflowEdge[] = [];
  for (const e of map.edges) {
    const source = remap(e.source);
    const target = remap(e.target);
    if (source === target) continue; // self-loop after merge
    const key = `${source}→${target}`;
    if (seen.has(key)) {
      // Keep a labeled edge over an unlabeled duplicate.
      if (e.label) {
        const existing = edges.find((x) => `${x.source}→${x.target}` === key);
        if (existing && !existing.label) existing.label = e.label;
      }
      continue;
    }
    seen.add(key);
    edges.push({ ...e, source, target });
  }

  const keep = map.nodes.find((n) => n.id === keepId);
  const dropped = map.nodes.filter((n) => drop.has(n.id));
  const mergedKeep: FutureWorkflowNode | undefined = keep
    ? {
        ...keep,
        guardrails: unionArrays(
          keep.guardrails,
          dropped.flatMap((d) => d.guardrails ?? []),
        ),
        metrics: unionArrays(
          keep.metrics,
          dropped.flatMap((d) => d.metrics ?? []),
        ),
        auditEvents: unionArrays(
          keep.auditEvents,
          dropped.flatMap((d) => d.auditEvents ?? []),
        ),
        sourceCurrentStateNodeIds: unionArrays(
          keep.sourceCurrentStateNodeIds,
          dropped.flatMap((d) => d.sourceCurrentStateNodeIds ?? []),
        ),
      }
    : keep;

  return {
    ...map,
    nodes: map.nodes
      .filter((n) => !drop.has(n.id))
      .map((n) => (n.id === keepId && mergedKeep ? mergedKeep : n)),
    edges,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

// Remove nodes + every edge incident to them.
export function removeNodes(
  map: FutureStateAIWorkflowMap,
  ids: string[],
): FutureStateAIWorkflowMap {
  const drop = new Set(ids);
  if (drop.size === 0) return map;
  return {
    ...map,
    nodes: map.nodes.filter((n) => !drop.has(n.id)),
    edges: map.edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)),
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

// Apply a set of confirmed decisions. Findings whose nodes no longer exist
// (already affected by an earlier decision) are skipped, so overlapping
// findings can't corrupt the map.
export function applyReview(
  map: FutureStateAIWorkflowMap,
  decisions: { finding: ReviewFinding; action: ReviewAction }[],
): FutureStateAIWorkflowMap {
  let next = map;
  for (const { finding, action } of decisions) {
    if (action === "keep") continue;
    const present = finding.nodeIds.filter((id) =>
      next.nodes.some((n) => n.id === id),
    );
    if (present.length === 0) continue;
    if (action === "merge") {
      const keepId =
        finding.keepId && present.includes(finding.keepId)
          ? finding.keepId
          : present[0];
      const dropIds = present.filter((id) => id !== keepId);
      if (dropIds.length > 0) next = mergeNodes(next, keepId, dropIds);
    } else if (action === "remove") {
      next = removeNodes(next, present);
    }
  }
  return next;
}

// Merge AI findings on top of rule findings, deduped by the involved node set
// (rule findings win on conflicts since they're deterministic).
export function mergeFindings(
  rule: ReviewFinding[],
  ai: ReviewFinding[],
): ReviewFinding[] {
  const key = (f: ReviewFinding) => [...f.nodeIds].sort().join("_");
  const seen = new Set(rule.map(key));
  return [...rule, ...ai.filter((f) => !seen.has(key(f)))];
}
