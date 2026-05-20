"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { EvidenceTrail } from "@/components/EvidenceTrail";
import { ProvenancePopover } from "@/components/ui/provenance-popover";
import type {
  DeploymentRisk,
  RiskCategory,
  RiskSeverity,
  RiskLikelihood,
  RiskStatus,
} from "@/lib/types";

type Props = {
  risks: DeploymentRisk[];
  onStatusChange?: (id: string, status: RiskStatus) => void;
  onDelete?: (id: string) => void;
  /** When provided, the empty state renders a "Run risk detection" CTA. */
  onDetect?: () => void;
};

const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const LIKELIHOOD_COLORS: Record<RiskLikelihood, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<RiskStatus, string> = {
  open: "bg-muted text-muted-foreground border-muted-foreground/30",
  mitigating: "bg-blue-100 text-blue-800 border-blue-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  accepted: "bg-purple-100 text-purple-800 border-purple-200",
};

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  data_readiness: "Data Readiness",
  integration: "Integration",
  security: "Security",
  stakeholder_alignment: "Stakeholder Alignment",
  operational_adoption: "Operational Adoption",
  model_quality: "Model Quality",
  timeline: "Timeline",
  legal_procurement: "Legal / Procurement",
  support_readiness: "Support Readiness",
};

const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function RiskRegister({
  risks,
  onStatusChange,
  onDelete,
  onDetect,
}: Props) {
  const [filterSeverity, setFilterSeverity] = useState<RiskSeverity | "all">(
    "all",
  );
  const [filterCategory, setFilterCategory] = useState<RiskCategory | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<
    RiskStatus | "open_only" | "all"
  >("open_only");

  const sorted = [...risks].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const filtered = sorted.filter((r) => {
    if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (
      filterStatus === "open_only" &&
      (r.status === "resolved" || r.status === "accepted")
    )
      return false;
    if (
      filterStatus !== "all" &&
      filterStatus !== "open_only" &&
      r.status !== filterStatus
    )
      return false;
    return true;
  });

  const criticalCount = risks.filter(
    (r) => r.severity === "critical" && r.status !== "resolved",
  ).length;
  const highCount = risks.filter(
    (r) => r.severity === "high" && r.status !== "resolved",
  ).length;
  const usedCategories = [...new Set(risks.map((r) => r.category))];

  if (risks.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="No risks yet"
        body="As you add systems and data sources, we'll automatically identify integration and security risks. You can also add custom ones below."
        cta={
          onDetect ? (
            <button
              type="button"
              onClick={onDetect}
              className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
            >
              Run risk detection now
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Risk summary */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="text-muted-foreground">
          {risks.length} total risks
        </span>
        {criticalCount > 0 && (
          <span className="text-red-700 font-medium">
            {criticalCount} critical
          </span>
        )}
        {highCount > 0 && (
          <span className="text-orange-700">{highCount} high</span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All Severities"],
            ["critical", "Critical"],
            ["high", "High"],
            ["medium", "Medium"],
            ["low", "Low"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilterSeverity(val)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              filterSeverity === val
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open_only", "Open Only"],
            ["all", "All Statuses"],
            ["open", "Open"],
            ["mitigating", "Mitigating"],
            ["accepted", "Accepted"],
            ["resolved", "Resolved"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilterStatus(val)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              filterStatus === val
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Risk list */}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No risks match the selected filters.
        </p>
      )}
      <div className="space-y-2">
        {filtered.map((risk) => (
          <RiskRow
            key={risk.id}
            risk={risk}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

type RiskRowProps = {
  risk: DeploymentRisk;
  onStatusChange?: (id: string, status: RiskStatus) => void;
  onDelete?: (id: string) => void;
};

function RiskRow({ risk, onStatusChange, onDelete }: RiskRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-background",
        risk.severity === "critical" && "border-red-200 bg-red-50/20",
        risk.status === "resolved" && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug inline-flex items-center gap-1.5">
            {risk.title}
            {risk.rationale && <ProvenancePopover rationale={risk.rationale} />}
          </p>
          {!expanded && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize">
                {CATEGORY_LABELS[risk.category]}
              </span>
              {risk.owner && risk.owner !== "shared" && (
                <span className="text-xs text-muted-foreground">
                  · {risk.owner}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {risk.source === "manual" && (
            <Badge
              variant="outline"
              className="text-xs bg-orange-50 text-orange-700 border-orange-200"
            >
              Custom
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn("text-xs capitalize", SEVERITY_COLORS[risk.severity])}
          >
            {risk.severity}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs capitalize",
              LIKELIHOOD_COLORS[risk.likelihood],
            )}
          >
            {risk.likelihood} prob.
          </Badge>
          {onStatusChange ? (
            <div className="w-28">
              <Select
                value={risk.status}
                onValueChange={(v) => onStatusChange(risk.id, v as RiskStatus)}
              >
                <SelectTrigger className="h-6 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="mitigating">Mitigating</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge
              variant="outline"
              className={cn("text-xs capitalize", STATUS_COLORS[risk.status])}
            >
              {risk.status}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            {expanded ? "Less" : "More"}
          </button>
          {risk.source === "manual" && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(risk.id)}
              className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-destructive/10 transition-colors"
              title="Delete risk"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {risk.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {risk.description}
            </p>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Mitigation
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {risk.mitigation || "No mitigation defined."}
            </p>
          </div>
          {risk.escalationTrigger && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Escalation trigger
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {risk.escalationTrigger}
              </p>
            </div>
          )}
          <EvidenceTrail refs={risk.sourceRefs} />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
            <span>Category: {CATEGORY_LABELS[risk.category]}</span>
            {risk.owner && (
              <span>
                Owner: <span className="capitalize">{risk.owner}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
