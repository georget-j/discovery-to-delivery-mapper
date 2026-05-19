"use client";

import { useState, useEffect } from "react";
import type { WorkflowNode } from "@/lib/visualisations/workflow-types";

type Props = {
  node: WorkflowNode | null;
  onUpdate: (id: string, patch: Partial<WorkflowNode>) => void;
  onDelete: (id: string) => void;
  onConvertToRisk?: (node: WorkflowNode) => void;
  onConvertToRequirement?: (node: WorkflowNode) => void;
};

export function WorkflowInspectorPanel({ node, onUpdate, onDelete, onConvertToRisk, onConvertToRequirement }: Props) {
  const [localTitle, setLocalTitle] = useState(node?.title ?? "");
  const [localDesc, setLocalDesc] = useState(node?.description ?? "");
  const [localOwner, setLocalOwner] = useState(node?.owner ?? "");

  useEffect(() => {
    setLocalTitle(node?.title ?? "");
    setLocalDesc(node?.description ?? "");
    setLocalOwner(node?.owner ?? "");
  }, [node?.id]);

  if (!node) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inspector</p>
        <p className="text-xs text-muted-foreground">Select a node to inspect and edit its details.</p>
      </div>
    );
  }

  const commit = (patch: Partial<WorkflowNode>) => onUpdate(node.id, patch);

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
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => commit({ title: localTitle })}
          className="w-full text-sm rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">Description</label>
        <textarea
          value={localDesc}
          rows={3}
          onChange={(e) => setLocalDesc(e.target.value)}
          onBlur={() => commit({ description: localDesc })}
          className="w-full text-xs rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">Owner</label>
        <input
          type="text"
          value={localOwner}
          onChange={(e) => setLocalOwner(e.target.value)}
          onBlur={() => commit({ owner: localOwner })}
          placeholder="e.g. AML Analyst"
          className="w-full text-sm rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {node.systems && node.systems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Systems</p>
          <div className="flex flex-wrap gap-1">
            {node.systems.map((s, i) => (
              <span key={i} className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5">{s}</span>
            ))}
          </div>
        </div>
      )}

      {node.painPoints && node.painPoints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Pain points</p>
          <ul className="text-xs space-y-1">
            {node.painPoints.map((p, i) => (
              <li key={i} className="text-muted-foreground leading-snug">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {node.risks && node.risks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Risks</p>
          <ul className="text-xs space-y-1">
            {node.risks.map((r, i) => (
              <li key={i} className="text-red-700 leading-snug">⚠ {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2 border-t space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
        {onConvertToRisk && (
          <button
            type="button"
            onClick={() => onConvertToRisk(node)}
            className="w-full text-xs px-2 py-1.5 rounded-md border text-left hover:bg-muted/50 transition-colors"
          >
            → Convert to risk
          </button>
        )}
        {onConvertToRequirement && (
          <button
            type="button"
            onClick={() => onConvertToRequirement(node)}
            className="w-full text-xs px-2 py-1.5 rounded-md border text-left hover:bg-muted/50 transition-colors"
          >
            → Convert to requirement
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
