"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  docs: number;
  chunks: number;
  tokens: number;
  busy: boolean;
  hasReadyDocs: boolean;
  onGenerateDiscovery: () => Promise<void> | void;
  onGenerateAll: () => Promise<void> | void;
};

export function KbSummary({
  docs,
  chunks,
  tokens,
  busy,
  hasReadyDocs,
  onGenerateDiscovery,
  onGenerateAll,
}: Props) {
  const [working, setWorking] = useState<null | "discovery" | "all">(null);

  const run = async (kind: "discovery" | "all") => {
    if (!hasReadyDocs || working) return;
    setWorking(kind);
    try {
      if (kind === "discovery") await onGenerateDiscovery();
      else await onGenerateAll();
    } finally {
      setWorking(null);
    }
  };

  const disabled = !hasReadyDocs || busy || !!working;
  const disabledHint = !hasReadyDocs
    ? "Add at least one document"
    : busy
      ? "Files are still processing"
      : "";

  return (
    <div className="rounded-md border bg-muted/10 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Knowledge base
        </p>
        <p className="text-xs text-muted-foreground">
          {docs} doc{docs !== 1 ? "s" : ""} · {chunks} chunk
          {chunks !== 1 ? "s" : ""} · ~{Math.round(tokens / 1000)}K tokens
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <ActionButton
          label="✨ Generate Discovery from KB"
          subtitle="Fills the Discovery tab from your uploads"
          disabled={disabled}
          working={working === "discovery"}
          onClick={() => run("discovery")}
          tooltip={disabledHint}
        />
        <ActionButton
          label="✨ Auto-populate ALL tabs"
          subtitle="Drafts workflows · systems · stakeholders · risks"
          disabled={disabled}
          working={working === "all"}
          onClick={() => run("all")}
          tooltip={disabledHint}
          primary
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  subtitle,
  disabled,
  working,
  onClick,
  tooltip,
  primary,
}: {
  label: string;
  subtitle: string;
  disabled: boolean;
  working: boolean;
  onClick: () => void;
  tooltip?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip || undefined}
      className={cn(
        "flex-1 text-left rounded-md border px-3 py-2 transition-colors",
        primary
          ? "bg-foreground text-background hover:bg-foreground/90 border-foreground"
          : "bg-background hover:bg-muted/30",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <p className="text-sm font-medium">{working ? "Working…" : label}</p>
      <p
        className={cn(
          "text-[11px] mt-0.5",
          primary ? "text-background/80" : "text-muted-foreground",
        )}
      >
        {subtitle}
      </p>
    </button>
  );
}
