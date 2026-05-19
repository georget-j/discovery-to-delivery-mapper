"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { getPrevNext } from "@/lib/journey";
import { cn } from "@/lib/utils";

export function PageNav() {
  const pathname = usePathname();
  const { project } = useWorkspace();

  if (!project) return null;

  const { prev, next } = getPrevNext(pathname, project.id);

  return (
    <div className="border-t pt-6 mt-8 flex items-center justify-between gap-4">
      {prev ? (
        <Link
          href={`/workspace/${project.id}${prev.tab.href}`}
          className="group flex items-center gap-3 px-4 py-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors min-w-0 flex-1 max-w-xs"
        >
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">←</span>
          <div className="min-w-0">
            <p className={cn("text-[10px] uppercase tracking-wider font-semibold", prev.phase.color.text)}>
              {prev.phase.label} · Previous
            </p>
            <p className="text-sm font-medium truncate">{prev.tab.label}</p>
          </div>
        </Link>
      ) : (
        <div className="flex-1 max-w-xs" />
      )}

      {next ? (
        <Link
          href={`/workspace/${project.id}${next.tab.href}`}
          className={cn(
            "group flex items-center justify-end gap-3 px-4 py-3 rounded-lg border bg-background hover:shadow-sm transition-all min-w-0 flex-1 max-w-xs ml-auto",
            next.phase.color.border,
          )}
        >
          <div className="min-w-0 text-right">
            <p className={cn("text-[10px] uppercase tracking-wider font-semibold", next.phase.color.text)}>
              {next.phase.label} · Next
            </p>
            <p className="text-sm font-medium truncate">{next.tab.label}</p>
          </div>
          <span className={cn("transition-colors", next.phase.color.text)}>→</span>
        </Link>
      ) : (
        <div className="flex-1 max-w-xs ml-auto" />
      )}
    </div>
  );
}
