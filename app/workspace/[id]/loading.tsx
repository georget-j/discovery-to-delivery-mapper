// Renders for the brief moment Next.js is hydrating the workspace shell.
// Once mounted, WorkspaceProvider takes over with its own loading state for
// the localStorage read.
export default function WorkspaceLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-3xl"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="space-y-2">
        <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-background px-4 py-4 space-y-2"
          >
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
