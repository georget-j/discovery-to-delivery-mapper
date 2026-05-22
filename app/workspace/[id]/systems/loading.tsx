import { Surface } from "@/components/ui/surface";

export default function SystemsLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-4xl"
      aria-busy="true"
      aria-label="Loading systems editor"
    >
      <div className="space-y-2">
        <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Surface key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
            <div className="h-3 flex-1 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
          </Surface>
        ))}
      </div>
    </div>
  );
}
