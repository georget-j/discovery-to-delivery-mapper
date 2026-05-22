"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { CoverageMatrix } from "@/components/outputs/CoverageMatrix";
import { PageNav } from "@/components/PageNav";

export default function OutputsCoverageMatrixPage() {
  const { project, loading } = useWorkspace();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  if (loading)
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  if (!project.outputs)
    return (
      <div className="px-8 py-10 max-w-3xl mx-auto space-y-4">
        <Link
          href={`/workspace/${params.id}/outputs`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Back to pack
        </Link>
        <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Generate the pack first — the matrix shows which inputs feed which
          artifact, so it needs the artifacts to exist.
        </div>
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 px-8 pt-8 pb-4 space-y-3 border-b bg-background/95 backdrop-blur">
        <Link
          href={`/workspace/${params.id}/outputs`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Back to pack
        </Link>
        <div>
          <h1 className="text-xl font-bold">Coverage Matrix</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bidirectional traceability. Every input you've captured, mapped to
            every artifact it feeds.
          </p>
        </div>
        <PageNav />
      </div>
      <div className="flex-1 overflow-y-auto bg-muted/20">
        <div className="px-8 py-6 max-w-6xl mx-auto">
          <CoverageMatrix
            project={project}
            onPickArtifact={(key) =>
              router.push(
                `/workspace/${params.id}/outputs?artifact=${encodeURIComponent(key)}`,
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
