"use client";

import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  canvas: ReactNode;
  inspector?: ReactNode;
  legend?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function VisualisationFrame({
  title,
  subtitle,
  toolbar,
  canvas,
  inspector,
  legend,
}: Props) {
  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {toolbar && <div className="flex items-center gap-2 shrink-0">{toolbar}</div>}
      </div>

      <div className="relative flex" style={{ height: 640 }}>
        <div className="flex-1 relative bg-muted/10">{canvas}</div>
        {inspector && (
          <div className="w-72 shrink-0 border-l bg-background overflow-y-auto">
            {inspector}
          </div>
        )}
      </div>

      {legend && (
        <div className="border-t bg-muted/20 px-4 py-2">{legend}</div>
      )}
    </div>
  );
}
