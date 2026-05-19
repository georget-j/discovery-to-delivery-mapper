import type { WorkflowStep } from "../types";

// A lightweight hash of the workflow snapshot used to detect whether a derived
// canvas (current-state or future-state map) is stale relative to the steps it
// was generated from. We hash the fields a user would notice if they changed:
// name, futureState (drives lane assignment), currentSystem (drives system nodes).
export function hashWorkflows(workflows: WorkflowStep[]): string {
  return workflows
    .map((w) => `${w.name}|${w.futureState}|${w.currentSystem}`)
    .join("::");
}
