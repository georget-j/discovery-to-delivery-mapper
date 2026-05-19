"use client";

import { useState, useEffect } from "react";
import type { FutureWorkflowNode, AutomationLevel } from "@/lib/visualisations/workflow-types";

type Props = {
  node: FutureWorkflowNode | null;
  onUpdate: (id: string, patch: Partial<FutureWorkflowNode>) => void;
  onDelete: (id: string) => void;
  onConvertToRequirement?: (node: FutureWorkflowNode) => void;
};

const AUTOMATION_OPTIONS: { value: AutomationLevel; label: string }[] = [
  { value: "suggest_only", label: "Suggest only" },
  { value: "draft_only", label: "Draft only" },
  { value: "human_approval_required", label: "Human approval required" },
  { value: "autonomous_with_guardrails", label: "Autonomous (with guardrails)" },
];

export function FutureWorkflowInspectorPanel({ node, onUpdate, onDelete, onConvertToRequirement }: Props) {
  const [title, setTitle] = useState(node?.title ?? "");
  const [desc, setDesc] = useState(node?.description ?? "");
  const [aiRole, setAiRole] = useState(node?.aiRole ?? "");
  const [guardrailDraft, setGuardrailDraft] = useState("");

  useEffect(() => {
    setTitle(node?.title ?? "");
    setDesc(node?.description ?? "");
    setAiRole(node?.aiRole ?? "");
    setGuardrailDraft("");
  }, [node?.id]);

  if (!node) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inspector</p>
        <p className="text-xs text-muted-foreground">Select a node to inspect and edit its details.</p>
      </div>
    );
  }

  const commit = (patch: Partial<FutureWorkflowNode>) => onUpdate(node.id, patch);
  const isAi = node.type === "ai_assist" || node.type === "ai_agent";

  const addGuardrail = () => {
    if (!guardrailDraft.trim()) return;
    commit({ guardrails: [...(node.guardrails ?? []), guardrailDraft.trim()] });
    setGuardrailDraft("");
  };

  const removeGuardrail = (i: number) => {
    commit({ guardrails: (node.guardrails ?? []).filter((_, idx) => idx !== i) });
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inspector</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5 capitalize">{node.type.replace(/_/g, " ")}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commit({ title })}
          className="w-full text-sm rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">Description</label>
        <textarea
          value={desc}
          rows={2}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => commit({ description: desc })}
          className="w-full text-xs rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {isAi && (
        <div className="pt-2 border-t space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Configuration</p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Model role</label>
            <input
              type="text"
              value={aiRole}
              onChange={(e) => setAiRole(e.target.value)}
              onBlur={() => commit({ aiRole })}
              placeholder="e.g. Case brief assistant"
              className="w-full text-sm rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Automation level</label>
            <select
              value={node.automationLevel ?? "draft_only"}
              onChange={(e) => commit({ automationLevel: e.target.value as AutomationLevel })}
              className="w-full text-xs rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {AUTOMATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={node.requiredHumanApproval ?? false}
              onChange={(e) => commit({ requiredHumanApproval: e.target.checked })}
              className="rounded border-input"
            />
            <span>Human approval required</span>
          </label>
        </div>
      )}

      <div className="pt-2 border-t space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Guardrails</p>
        {(node.guardrails ?? []).length > 0 ? (
          <div className="space-y-1">
            {(node.guardrails ?? []).map((g, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-pink-50 border border-pink-200 rounded px-2 py-1">
                <span className="text-pink-900">🛡 {g}</span>
                <button
                  type="button"
                  onClick={() => removeGuardrail(i)}
                  className="text-pink-700 hover:text-pink-900 text-xs"
                  aria-label="Remove guardrail"
                >×</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">No guardrails defined.</p>
        )}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={guardrailDraft}
            onChange={(e) => setGuardrailDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuardrail(); } }}
            placeholder="Add guardrail…"
            className="flex-1 text-xs rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={addGuardrail}
            className="text-xs px-2 py-1 rounded-md border hover:bg-muted/50 transition-colors"
          >+</button>
        </div>
      </div>

      {(node.metrics ?? []).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Metrics</p>
          <ul className="text-xs space-y-0.5">
            {(node.metrics ?? []).map((m, i) => (
              <li key={i} className="text-muted-foreground leading-snug">• {m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2 border-t space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
        {onConvertToRequirement && (
          <button
            type="button"
            onClick={() => onConvertToRequirement(node)}
            className="w-full text-xs px-2 py-1.5 rounded-md border text-left hover:bg-muted/50 transition-colors"
          >
            → Create requirement from this
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="w-full text-xs px-2 py-1.5 rounded-md border border-red-200 text-red-700 text-left hover:bg-red-50 transition-colors"
        >
          Delete node
        </button>
      </div>
    </div>
  );
}
