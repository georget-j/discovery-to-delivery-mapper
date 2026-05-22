"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { listLocalProjects, deleteProject } from "@/lib/project-store";
import type { OnboardingProject } from "@/lib/types";
import { formatDate } from "@/lib/utils";

// Lists user-created (non-seeded) projects from localStorage. Hidden when
// empty so the scenarios page stays clean for first-time visitors.
export function LocalProjectsList() {
  const [projects, setProjects] = useState<OnboardingProject[] | null>(null);

  useEffect(() => {
    setProjects(listLocalProjects());
  }, []);

  if (!projects || projects.length === 0) return null;

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteProject(id);
    setProjects(listLocalProjects());
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Your projects
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((p) => {
          const displayName =
            p.customer.companyName?.trim() || p.name || "Untitled Project";
          return (
            <Surface
              key={p.id}
              variant="interactive"
              className="px-4 py-3 flex items-start gap-3"
            >
              <Link
                href={`/workspace/${p.id}`}
                className="flex-1 min-w-0 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{displayName}</p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {p.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Updated {formatDate(p.updatedAt)}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(p.id, displayName)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label={`Delete ${displayName}`}
                title="Delete project"
              >
                ✕
              </button>
            </Surface>
          );
        })}
      </div>
    </section>
  );
}
