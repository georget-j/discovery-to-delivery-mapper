"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App-level error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-background">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-5xl">⚠️</p>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The app hit an unexpected error. Your session data is safe — try reloading the page.
        </p>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground/70 font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Try again
          </button>
          <a
            href="/scenarios"
            className="text-sm px-4 py-2 rounded-md border hover:bg-muted/50 transition-colors"
          >
            Back to scenarios
          </a>
        </div>
      </div>
    </div>
  );
}
