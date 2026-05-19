import type {
  CurrentStateWorkflowMap,
  FutureStateAIWorkflowMap,
  WorkflowNode,
  FutureWorkflowNode,
} from "./workflow-types";

function escape(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/[\[\]\{\}\(\)]/g, "");
}

function shape(node: WorkflowNode): string {
  const label = escape(node.title);
  switch (node.type) {
    case "decision":       return `${node.id}{"${label}"}`;
    case "system_step":    return `${node.id}[("${label}")]`;
    case "risk":           return `${node.id}>"⚠ ${label}"]`;
    case "missing_info":   return `${node.id}["? ${label}"]`;
    case "data_object":    return `${node.id}[/"${label}"/]`;
    default:               return `${node.id}("${label}")`;
  }
}

function futureShape(node: FutureWorkflowNode): string {
  const label = escape(node.title);
  switch (node.type) {
    case "decision_gate":  return `${node.id}{"${label}"}`;
    case "data_retrieval":
    case "system_action":  return `${node.id}[("${label}")]`;
    case "guardrail":      return `${node.id}["🛡 ${label}"]`;
    case "audit_log":
    case "monitoring":     return `${node.id}[/"${label}"/]`;
    default:               return `${node.id}("${label}")`;
  }
}

export function currentStateToMermaid(map: CurrentStateWorkflowMap): string {
  const lines: string[] = ["flowchart LR"];
  for (const lane of map.lanes) {
    lines.push(`  subgraph ${lane.id}["${escape(lane.title)}"]`);
    for (const node of map.nodes.filter((n) => n.laneId === lane.id)) {
      lines.push(`    ${shape(node)}`);
    }
    lines.push(`  end`);
  }
  for (const edge of map.edges) {
    const arrow = edge.style === "dashed" ? "-.->" : "-->";
    const label = edge.label ? `|${escape(edge.label)}|` : "";
    lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`);
  }
  return lines.join("\n");
}

export function futureStateToMermaid(map: FutureStateAIWorkflowMap): string {
  const lines: string[] = ["flowchart LR"];
  for (const lane of map.lanes) {
    lines.push(`  subgraph ${lane.id}["${escape(lane.title)}"]`);
    for (const node of map.nodes.filter((n) => n.laneId === lane.id)) {
      lines.push(`    ${futureShape(node)}`);
    }
    lines.push(`  end`);
  }
  for (const edge of map.edges) {
    const arrow = edge.style === "dashed" ? "-.->" : "-->";
    const label = edge.label ? `|${escape(edge.label)}|` : "";
    lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`);
  }
  return lines.join("\n");
}
