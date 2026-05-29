"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useMapEdit } from "../shared/MapEditContext";
import {
  NodeActionToolbar,
  type NodeAction,
} from "../shared/NodeActionToolbar";
import { NodeProposalPopover } from "./NodeProposalPopover";
import type {
  FutureWorkflowNode as NodeData,
  FutureWorkflowNodeType,
} from "@/lib/visualisations/workflow-types";
import { AutomationLevelBadge } from "./AutomationLevelBadge";
import { GuardrailBadge } from "./GuardrailBadge";

// Card hover affordance shared by both node shapes — lift + grab cursor so the
// canvas feels manipulable rather than static.
const HOVER_CARD =
  "transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-px";

const TYPE_STYLES: Record<
  FutureWorkflowNodeType,
  { container: string; label: string; typeLabel: string }
> = {
  human_action: {
    container: "border-blue-300 bg-blue-50/80",
    label: "text-blue-900",
    typeLabel: "Human",
  },
  ai_assist: {
    container: "border-violet-300 bg-violet-50/80",
    label: "text-violet-900",
    typeLabel: "AI assist",
  },
  ai_agent: {
    container: "border-violet-400 bg-violet-100/80",
    label: "text-violet-900",
    typeLabel: "AI agent",
  },
  system_action: {
    container: "border-emerald-300 bg-emerald-50/80",
    label: "text-emerald-900",
    typeLabel: "System",
  },
  data_retrieval: {
    container: "border-emerald-300 bg-emerald-50/80",
    label: "text-emerald-900",
    typeLabel: "Retrieval",
  },
  guardrail: {
    container: "border-pink-300 bg-pink-50/80",
    label: "text-pink-900",
    typeLabel: "Guardrail",
  },
  decision_gate: {
    container: "border-amber-300 bg-amber-50/80",
    label: "text-amber-900",
    typeLabel: "Decision",
  },
  approval: {
    container: "border-blue-400 bg-blue-100/80",
    label: "text-blue-900",
    typeLabel: "Approval",
  },
  monitoring: {
    container: "border-cyan-300 bg-cyan-50/80",
    label: "text-cyan-900",
    typeLabel: "Monitoring",
  },
  audit_log: {
    container: "border-cyan-300 bg-cyan-50/80 border-dashed",
    label: "text-cyan-900",
    typeLabel: "Audit log",
  },
  exception_path: {
    container: "border-red-300 bg-red-50/80",
    label: "text-red-900",
    typeLabel: "Exception",
  },
};

function FutureWorkflowNodeImpl({ id, data, selected }: NodeProps) {
  const node = data as unknown as NodeData;
  const style = TYPE_STYLES[node.type];
  const isAi = node.type === "ai_assist" || node.type === "ai_agent";
  const {
    patchNode,
    duplicateNode,
    deleteNode,
    convertToRequirement,
    getProposals,
    applyProposal,
    setPreview,
    askAiForNode,
  } = useMapEdit();

  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showProposals, setShowProposals] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(node.title);
  }, [node.title]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== node.title)
      patchNode(id, { title: draft.trim() });
  };
  const cancel = () => {
    setEditing(false);
    setDraft(node.title);
  };

  // Toolbar actions are built from whichever callbacks the canvas provides, so
  // ✨ Propose only appears once the proposal flow is wired in.
  const actions: NodeAction[] = [];
  if (getProposals)
    actions.push({
      key: "propose",
      label: "Propose AI augmentation",
      icon: "✨",
      emphasis: true,
      onClick: () => setShowProposals((v) => !v),
    });
  if (duplicateNode)
    actions.push({
      key: "duplicate",
      label: "Duplicate",
      icon: "⧉",
      onClick: () => duplicateNode(id),
    });
  if (convertToRequirement)
    actions.push({
      key: "convert",
      label: "Convert to requirement",
      icon: "→",
      onClick: () => convertToRequirement(id),
    });
  if (deleteNode)
    actions.push({
      key: "delete",
      label: "Delete",
      icon: "✕",
      danger: true,
      onClick: () => deleteNode(id),
    });
  const toolbar = (
    <NodeActionToolbar visible={hovered || !!selected} actions={actions} />
  );

  const closeProposals = () => {
    setShowProposals(false);
    setPreview?.(null);
  };
  const proposalsPanel =
    showProposals && getProposals && applyProposal ? (
      <NodeToolbar isVisible position={Position.Bottom} offset={10}>
        <NodeProposalPopover
          proposals={getProposals(id)}
          onApply={(p) => {
            // AI moves may target a different stage than this node — honour
            // their preferred anchor so they wire into the right place.
            applyProposal(p, p.preferredSourceNodeId ?? id);
            closeProposals();
          }}
          onPreview={(p) =>
            setPreview?.(
              p
                ? { proposal: p, sourceNodeId: p.preferredSourceNodeId ?? id }
                : null,
            )
          }
          onAskAi={askAiForNode ? () => askAiForNode(id) : undefined}
          onClose={closeProposals}
        />
      </NodeToolbar>
    ) : null;

  const hoverHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (node.type === "decision_gate") {
    return (
      <div className="relative" {...hoverHandlers}>
        {toolbar}
        {proposalsPanel}
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-amber-500 !w-2 !h-2"
        />
        <div
          className={cn(
            "w-32 h-32 border-2 rotate-45 flex items-center justify-center",
            HOVER_CARD,
            style.container,
            selected && "shadow-lg ring-2 ring-amber-400",
          )}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          <div className="-rotate-45 text-center px-2 w-full">
            <p
              className={cn(
                "text-[10px] uppercase tracking-wider font-medium opacity-60",
                style.label,
              )}
            >
              Decision
            </p>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
                className={cn(
                  "w-full text-xs font-medium leading-tight mt-0.5 text-center bg-white/80 border border-amber-400 rounded px-1",
                  style.label,
                )}
              />
            ) : (
              <p
                className={cn(
                  "text-xs font-medium leading-tight mt-0.5",
                  style.label,
                )}
              >
                {node.title}
              </p>
            )}
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-amber-500 !w-2 !h-2"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!bg-amber-500 !w-2 !h-2"
        />
      </div>
    );
  }

  return (
    <div className="relative" {...hoverHandlers}>
      {toolbar}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !w-2 !h-2"
      />
      <div
        className={cn(
          "rounded-md border-2 px-3 py-2 min-w-[180px] max-w-[220px] shadow-sm",
          HOVER_CARD,
          style.container,
          selected && "shadow-lg ring-2 ring-primary/40",
        )}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-[10px] uppercase tracking-wider font-medium opacity-60",
              style.label,
            )}
          >
            {style.typeLabel}
          </p>
          {node.requiredHumanApproval && (
            <span className="text-[10px] text-amber-700">👤 approval</span>
          )}
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className={cn(
              "w-full text-xs font-semibold leading-snug mt-0.5 bg-white/80 border border-primary/40 rounded px-1 focus:outline-none focus:ring-1 focus:ring-primary",
              style.label,
            )}
          />
        ) : (
          <p
            className={cn(
              "text-xs font-semibold leading-snug mt-0.5",
              style.label,
            )}
          >
            {node.title}
          </p>
        )}
        {node.description && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">
            {node.description}
          </p>
        )}
        {isAi && node.automationLevel && (
          <div className="mt-1.5">
            <AutomationLevelBadge level={node.automationLevel} />
          </div>
        )}
        {node.guardrails && node.guardrails.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {node.guardrails.slice(0, 2).map((g, i) => (
              <GuardrailBadge key={i} label={g} />
            ))}
            {node.guardrails.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{node.guardrails.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-400 !w-2 !h-2"
      />
    </div>
  );
}

export const FutureWorkflowNode = memo(FutureWorkflowNodeImpl);
