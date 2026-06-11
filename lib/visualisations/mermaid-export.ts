import type {
  CurrentStateWorkflowMap,
  FutureStateAIWorkflowMap,
  WorkflowNode,
  FutureWorkflowNode,
} from "./workflow-types";

function escape(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/[\[\]\{\}\(\)]/g, "");
}

// Ids are interpolated outside quoted labels, so they must stay bare
// identifiers: whitespace/metacharacters would break the parse or inject
// directives (click/class/linkStyle), and the bare word "end" closes a
// subgraph.
const safeId = (s: string) => {
  const id = s.replace(/[^A-Za-z0-9_]/g, "_");
  return id === "end" ? "end_" : id;
};

function shape(node: WorkflowNode): string {
  const id = safeId(node.id);
  const label = escape(node.title);
  switch (node.type) {
    case "decision":
      return `${id}{"${label}"}`;
    case "system_step":
      return `${id}[("${label}")]`;
    case "risk":
      return `${id}>"⚠ ${label}"]`;
    case "missing_info":
      return `${id}["? ${label}"]`;
    case "data_object":
      return `${id}[/"${label}"/]`;
    default:
      return `${id}("${label}")`;
  }
}

function futureShape(node: FutureWorkflowNode): string {
  const id = safeId(node.id);
  const label = escape(node.title);
  switch (node.type) {
    case "decision_gate":
      return `${id}{"${label}"}`;
    case "data_retrieval":
    case "system_action":
      return `${id}[("${label}")]`;
    case "guardrail":
      return `${id}["🛡 ${label}"]`;
    case "audit_log":
    case "monitoring":
      return `${id}[/"${label}"/]`;
    default:
      return `${id}("${label}")`;
  }
}

export function currentStateToMermaid(map: CurrentStateWorkflowMap): string {
  const lines: string[] = ["flowchart LR"];
  for (const lane of map.lanes) {
    lines.push(`  subgraph ${safeId(lane.id)}["${escape(lane.title)}"]`);
    for (const node of map.nodes.filter((n) => n.laneId === lane.id)) {
      lines.push(`    ${shape(node)}`);
    }
    lines.push(`  end`);
  }
  for (const edge of map.edges) {
    const arrow = edge.style === "dashed" ? "-.->" : "-->";
    const label = edge.label ? `|${escape(edge.label)}|` : "";
    lines.push(
      `  ${safeId(edge.source)} ${arrow}${label} ${safeId(edge.target)}`,
    );
  }
  return lines.join("\n");
}

export function futureStateToMermaid(map: FutureStateAIWorkflowMap): string {
  const lines: string[] = ["flowchart LR"];
  for (const lane of map.lanes) {
    lines.push(`  subgraph ${safeId(lane.id)}["${escape(lane.title)}"]`);
    for (const node of map.nodes.filter((n) => n.laneId === lane.id)) {
      lines.push(`    ${futureShape(node)}`);
    }
    lines.push(`  end`);
  }
  for (const edge of map.edges) {
    const arrow = edge.style === "dashed" ? "-.->" : "-->";
    const label = edge.label ? `|${escape(edge.label)}|` : "";
    lines.push(
      `  ${safeId(edge.source)} ${arrow}${label} ${safeId(edge.target)}`,
    );
  }
  return lines.join("\n");
}
