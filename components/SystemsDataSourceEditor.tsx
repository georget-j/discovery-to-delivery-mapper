"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { validateRequired } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import type {
  CustomerSystem,
  DataSource,
  SystemType,
  AccessMethod,
  DataSensitivity,
  IntegrationComplexity,
  DataType,
  DataFormat,
  DataQuality,
  AccessStatus,
} from "@/lib/types";

// ─── Label maps ────────────────────────────────────────────────────────────────

const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  crm: "CRM",
  case_management: "Case Management",
  document_management: "Document Management",
  data_warehouse: "Data Warehouse",
  ticketing: "Ticketing",
  email: "Email",
  chat: "Chat",
  core_system: "Core System",
  custom: "Custom",
  other: "Other",
};

const ACCESS_METHOD_LABELS: Record<AccessMethod, string> = {
  api: "API",
  database: "Database",
  csv_export: "CSV Export",
  manual_upload: "Manual Upload",
  webhook: "Webhook",
  unknown: "Unknown",
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  documents: "Documents",
  tickets: "Tickets",
  customer_records: "Customer Records",
  transactions: "Transactions",
  contracts: "Contracts",
  messages: "Messages",
  logs: "Logs",
  other: "Other",
};

const DATA_FORMAT_LABELS: Record<DataFormat, string> = {
  pdf: "PDF",
  docx: "DOCX",
  csv: "CSV",
  xlsx: "XLSX",
  json: "JSON",
  api: "API",
  database: "Database",
  mixed: "Mixed",
  unknown: "Unknown",
};

// ─── Colour maps ───────────────────────────────────────────────────────────────

const SENSITIVITY_COLOR: Record<DataSensitivity, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  regulated: "bg-red-100 text-red-800 border-red-200",
};

const COMPLEXITY_COLOR: Record<IntegrationComplexity, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
};

const ACCESS_STATUS_COLOR: Record<AccessStatus, string> = {
  available: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
  unknown: "bg-muted text-muted-foreground border-muted-foreground/30",
};

const QUALITY_COLOR: Record<DataQuality, string> = {
  good: "bg-green-100 text-green-800 border-green-200",
  mixed: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-red-100 text-red-800 border-red-200",
  unknown: "bg-muted text-muted-foreground border-muted-foreground/30",
};

// ─── Factories ─────────────────────────────────────────────────────────────────

function newSystem(): CustomerSystem {
  return {
    id: generateId(),
    name: "",
    type: "other",
    owner: "",
    accessMethod: "api",
    apiAvailable: "unknown",
    authenticationMethod: "",
    dataSensitivity: "medium",
    integrationComplexity: "medium",
    notes: "",
  };
}

function newDataSource(): DataSource {
  return {
    id: generateId(),
    name: "",
    sourceSystem: "",
    dataType: "other",
    format: "unknown",
    quality: "unknown",
    volumeEstimate: "",
    updateFrequency: "",
    pii: "unknown",
    accessStatus: "unknown",
    openQuestions: [],
  };
}

// ─── System Row ────────────────────────────────────────────────────────────────

type SystemRowProps = {
  system: CustomerSystem;
  onUpdate: (patch: Partial<CustomerSystem>) => void;
  onRemove: () => void;
};

function SystemRow({ system, onUpdate, onRemove }: SystemRowProps) {
  const [open, setOpen] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const apiFlag = system.apiAvailable === false;

  return (
    <div
      id={system.id}
      className={cn(
        "rounded-lg border bg-background scroll-mt-20",
        apiFlag && "border-orange-200 bg-orange-50/30",
        open && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {apiFlag && (
          <span
            className="text-orange-500 text-xs shrink-0 font-bold"
            title="No API available"
          >
            ⚠
          </span>
        )}
        <div className="flex-1 min-w-0">
          {open ? (
            <div className="space-y-1">
              <Input
                value={system.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                onBlur={(e) =>
                  setNameError(validateRequired(e.target.value, "System name"))
                }
                aria-invalid={!!nameError}
                placeholder="System name…"
                className="h-7 text-sm font-medium"
              />
              {nameError && (
                <p className="text-[11px] text-destructive" role="alert">
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium truncate">
              {system.name || (
                <span className="text-muted-foreground italic">
                  Unnamed system
                </span>
              )}
            </p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {SYSTEM_TYPE_LABELS[system.type]}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {ACCESS_METHOD_LABELS[system.accessMethod]}
          </span>
          <Badge
            variant="outline"
            className={cn("text-xs", SENSITIVITY_COLOR[system.dataSensitivity])}
          >
            {system.dataSensitivity.charAt(0).toUpperCase() +
              system.dataSensitivity.slice(1)}{" "}
            data
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              COMPLEXITY_COLOR[system.integrationComplexity],
            )}
          >
            {system.integrationComplexity.charAt(0).toUpperCase() +
              system.integrationComplexity.slice(1)}{" "}
            complexity
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            {open ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-destructive/70 hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <>
          <Separator />
          <div className="px-4 py-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>System Type</Label>
                <Select
                  value={system.type}
                  onValueChange={(v) => onUpdate({ type: v as SystemType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(SYSTEM_TYPE_LABELS) as [
                        SystemType,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Owner / Team</Label>
                <Input
                  value={system.owner}
                  onChange={(e) => onUpdate({ owner: e.target.value })}
                  placeholder="e.g. IT, Compliance…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Access Method</Label>
                <Select
                  value={system.accessMethod}
                  onValueChange={(v) =>
                    onUpdate({ accessMethod: v as AccessMethod })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(ACCESS_METHOD_LABELS) as [
                        AccessMethod,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>API Available</Label>
                <Select
                  value={String(system.apiAvailable)}
                  onValueChange={(v) =>
                    onUpdate({
                      apiAvailable: v === "unknown" ? "unknown" : v === "true",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5">
                  Data Sensitivity
                  <InfoTip
                    label="Data sensitivity levels"
                    items={[
                      {
                        term: "Low",
                        hint: "Public or non-sensitive — fine to send to any LLM",
                      },
                      {
                        term: "Medium",
                        hint: "Internal business data — needs basic controls",
                      },
                      {
                        term: "High",
                        hint: "Confidential / customer data — needs encryption + access logs",
                      },
                      {
                        term: "Regulated",
                        hint: "PII, PHI, financial — needs DPA, residency, audit trail",
                      },
                    ]}
                  />
                </Label>
                <Select
                  value={system.dataSensitivity}
                  onValueChange={(v) =>
                    onUpdate({ dataSensitivity: v as DataSensitivity })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="regulated">Regulated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5">
                  Integration Complexity
                  <InfoTip
                    label="Integration complexity"
                    items={[
                      {
                        term: "Low",
                        hint: "Off-the-shelf API, well-documented, public SDK",
                      },
                      {
                        term: "Medium",
                        hint: "Custom auth, sandbox env, some schema mapping",
                      },
                      {
                        term: "High",
                        hint: "Legacy / undocumented, requires vendor engagement",
                      },
                    ]}
                  />
                </Label>
                <Select
                  value={system.integrationComplexity}
                  onValueChange={(v) =>
                    onUpdate({
                      integrationComplexity: v as IntegrationComplexity,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Authentication Method</Label>
                <Input
                  value={system.authenticationMethod}
                  onChange={(e) =>
                    onUpdate({ authenticationMethod: e.target.value })
                  }
                  placeholder="OAuth 2.0, API key, SSO…"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={system.notes}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                placeholder="Integration caveats, known blockers…"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Data Source Row ───────────────────────────────────────────────────────────

type DataSourceRowProps = {
  source: DataSource;
  onUpdate: (patch: Partial<DataSource>) => void;
  onRemove: () => void;
};

function DataSourceRow({ source, onUpdate, onRemove }: DataSourceRowProps) {
  const [open, setOpen] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const blocked = source.accessStatus === "blocked";

  return (
    <div
      id={source.id}
      className={cn(
        "rounded-lg border bg-background scroll-mt-20",
        blocked && "border-red-200 bg-red-50/30",
        open && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {blocked && (
          <span
            className="text-red-600 text-xs shrink-0 font-bold"
            title="Access blocked"
          >
            ✕
          </span>
        )}
        <div className="flex-1 min-w-0">
          {open ? (
            <div className="space-y-1">
              <Input
                value={source.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                onBlur={(e) =>
                  setNameError(
                    validateRequired(e.target.value, "Data source name"),
                  )
                }
                aria-invalid={!!nameError}
                placeholder="Data source name…"
                className="h-7 text-sm font-medium"
              />
              {nameError && (
                <p className="text-[11px] text-destructive" role="alert">
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium truncate">
              {source.name || (
                <span className="text-muted-foreground italic">
                  Unnamed source
                </span>
              )}
            </p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {source.sourceSystem && !open && (
            <span className="text-xs text-muted-foreground">
              {source.sourceSystem}
            </span>
          )}
          <Badge
            variant="outline"
            className={cn("text-xs", ACCESS_STATUS_COLOR[source.accessStatus])}
          >
            {source.accessStatus.charAt(0).toUpperCase() +
              source.accessStatus.slice(1)}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-xs", QUALITY_COLOR[source.quality])}
          >
            {source.quality.charAt(0).toUpperCase() + source.quality.slice(1)}{" "}
            quality
          </Badge>
          {source.pii === true && (
            <Badge
              variant="outline"
              className="text-xs bg-purple-100 text-purple-800 border-purple-200"
            >
              PII
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            {open ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-destructive/70 hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <>
          <Separator />
          <div className="px-4 py-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Source System</Label>
                <Input
                  value={source.sourceSystem}
                  onChange={(e) => onUpdate({ sourceSystem: e.target.value })}
                  placeholder="e.g. Salesforce CRM…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data Type</Label>
                <Select
                  value={source.dataType}
                  onValueChange={(v) => onUpdate({ dataType: v as DataType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(DATA_TYPE_LABELS) as [DataType, string][]
                    ).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select
                  value={source.format}
                  onValueChange={(v) => onUpdate({ format: v as DataFormat })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(DATA_FORMAT_LABELS) as [
                        DataFormat,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5">
                  Data Quality
                  <InfoTip
                    label="Data quality"
                    items={[
                      {
                        term: "Good",
                        hint: "Clean, consistent schema, low missing-field rate",
                      },
                      {
                        term: "Mixed",
                        hint: "Usable but needs cleanup or normalisation",
                      },
                      {
                        term: "Poor",
                        hint: "Free-text, malformed, gaps — needs upstream fixes",
                      },
                      {
                        term: "Unknown",
                        hint: "Haven't sampled yet — surface as a discovery action",
                      },
                    ]}
                  />
                </Label>
                <Select
                  value={source.quality}
                  onValueChange={(v) => onUpdate({ quality: v as DataQuality })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5">
                  Access Status
                  <InfoTip
                    label="Access status"
                    items={[
                      {
                        term: "Available",
                        hint: "You can pull this data today — no blockers",
                      },
                      {
                        term: "Pending",
                        hint: "Approved in principle; awaiting credentials / contract",
                      },
                      {
                        term: "Blocked",
                        hint: "Cannot access — needs escalation or workaround",
                      },
                      {
                        term: "Unknown",
                        hint: "Haven't asked yet — discovery action",
                      },
                    ]}
                  />
                </Label>
                <Select
                  value={source.accessStatus}
                  onValueChange={(v) =>
                    onUpdate({ accessStatus: v as AccessStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contains PII</Label>
                <Select
                  value={String(source.pii)}
                  onValueChange={(v) =>
                    onUpdate({
                      pii: v === "unknown" ? "unknown" : v === "true",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Volume Estimate</Label>
                <Input
                  value={source.volumeEstimate}
                  onChange={(e) => onUpdate({ volumeEstimate: e.target.value })}
                  placeholder="e.g. 10k records/month…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Update Frequency</Label>
                <Input
                  value={source.updateFrequency}
                  onChange={(e) =>
                    onUpdate({ updateFrequency: e.target.value })
                  }
                  placeholder="e.g. Real-time, daily…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Open Questions{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    (comma-separated)
                  </span>
                </Label>
                <Input
                  value={source.openQuestions.join(", ")}
                  onChange={(e) =>
                    onUpdate({
                      openQuestions: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Who owns schema changes? Is historical data retained?…"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Combined Editor ────────────────────────────────────────────────────────────

type Props = {
  systems: CustomerSystem[];
  dataSources: DataSource[];
  onSystemsChange: (systems: CustomerSystem[]) => void;
  onDataSourcesChange: (sources: DataSource[]) => void;
};

export function SystemsDataSourceEditor({
  systems,
  dataSources,
  onSystemsChange,
  onDataSourcesChange,
}: Props) {
  const updateSystem = (id: string, patch: Partial<CustomerSystem>) =>
    onSystemsChange(systems.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSystem = (id: string) =>
    onSystemsChange(systems.filter((s) => s.id !== id));

  const updateSource = (id: string, patch: Partial<DataSource>) =>
    onDataSourcesChange(
      dataSources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  const removeSource = (id: string) =>
    onDataSourcesChange(dataSources.filter((s) => s.id !== id));

  const systemsNeedingAttention = systems.filter(
    (s) => s.apiAvailable === false || s.integrationComplexity === "high",
  ).length;
  const sourcesNeedingAttention = dataSources.filter(
    (s) => s.accessStatus === "blocked" || s.quality === "poor",
  ).length;

  return (
    <div className="space-y-10">
      {/* Systems */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Customer Systems
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Systems the AI product must read from or write to. Click Edit to
              configure integration details.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <span className="text-xs text-muted-foreground">
              {systems.length} system{systems.length !== 1 ? "s" : ""}
            </span>
            {systemsNeedingAttention > 0 && (
              <Badge
                variant="outline"
                className="text-xs bg-orange-100 text-orange-800 border-orange-200"
              >
                {systemsNeedingAttention} need attention
              </Badge>
            )}
          </div>
        </div>

        {systems.length === 0 && (
          <EmptyState
            icon="🔌"
            title="No systems yet"
            body="Add every tool the AI reads from or writes to — CRM, case manager, ticketing, document store, etc."
          />
        )}
        {systems.map((s) => (
          <SystemRow
            key={s.id}
            system={s}
            onUpdate={(p) => updateSystem(s.id, p)}
            onRemove={() => removeSystem(s.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => onSystemsChange([...systems, newSystem()])}
          className="w-full rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors"
        >
          + Add system
        </button>
      </section>

      <Separator />

      {/* Data Sources */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Data Sources
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Datasets the AI model will train on or use for inference. Flag PII
              and access issues here.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <span className="text-xs text-muted-foreground">
              {dataSources.length} source{dataSources.length !== 1 ? "s" : ""}
            </span>
            {sourcesNeedingAttention > 0 && (
              <Badge
                variant="outline"
                className="text-xs bg-red-100 text-red-800 border-red-200"
              >
                {sourcesNeedingAttention} need attention
              </Badge>
            )}
          </div>
        </div>

        {dataSources.length === 0 && (
          <EmptyState
            icon="🗂"
            title="No data sources yet"
            body="Add datasets the AI ingests — transactions, tickets, contracts, telemetry. Quality and PII flags drive risks."
          />
        )}
        {dataSources.map((s) => (
          <DataSourceRow
            key={s.id}
            source={s}
            onUpdate={(p) => updateSource(s.id, p)}
            onRemove={() => removeSource(s.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => onDataSourcesChange([...dataSources, newDataSource()])}
          className="w-full rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors"
        >
          + Add data source
        </button>
      </section>
    </div>
  );
}
