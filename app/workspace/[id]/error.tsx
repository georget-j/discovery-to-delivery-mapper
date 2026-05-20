"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches render errors inside the workspace tree without nuking the whole app.
// Sessions are stored client-side in localStorage so the user's work is intact.
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-4xl">⚠️</p>
        <h2 className="text-lg font-semibold">Workspace hit an error</h2>
        <p className="text-sm text-muted-foreground">
          A view in this workspace failed to render. Your saved data is intact —
          try resetting this view, or head back to the scenarios list.
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <button
            type="button"
            onClick={reset}
            className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Reset view
          </button>
          <Link
            href="/scenarios"
            className="text-sm px-4 py-2 rounded-md border hover:bg-muted/50 transition-colors"
          >
            Back to scenarios
          </Link>
        </div>
      </div>
    </div>
  );
}
