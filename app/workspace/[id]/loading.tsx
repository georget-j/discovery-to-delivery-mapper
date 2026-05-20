// Renders for the brief moment Next.js is hydrating the workspace shell.
// Once mounted, WorkspaceProvider takes over with its own loading state for
// the localStorage read.
export default function WorkspaceLoading() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-sm text-muted-foreground">Loading workspace…</div>
    </div>
  );
}
