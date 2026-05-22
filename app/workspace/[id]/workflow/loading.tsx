import { Surface } from "@/components/ui/surface";

export default function WorkflowLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-6xl"
      aria-busy="true"
      aria-label="Loading workflow"
    >
      <div className="space-y-2">
        <div className="h-5 w-44 rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="flex gap-1 border-b pb-2">
        <div className="h-7 w-16 rounded-t bg-muted animate-pulse" />
        <div className="h-7 w-28 rounded-t bg-muted/60 animate-pulse" />
        <div className="h-7 w-28 rounded-t bg-muted/60 animate-pulse" />
      </div>
      <Surface className="p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
        ))}
      </Surface>
    </div>
  );
}
