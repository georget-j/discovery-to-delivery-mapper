import { Surface } from "@/components/ui/surface";

export default function RequirementsLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-5xl"
      aria-busy="true"
      aria-label="Loading requirements matrix"
    >
      <div className="space-y-2">
        <div className="h-5 w-52 rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-20 rounded-full bg-muted/60 animate-pulse"
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Surface key={i} className="px-4 py-3 space-y-1.5">
            <div className="h-3 w-3/5 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-2/5 rounded bg-muted/60 animate-pulse" />
          </Surface>
        ))}
      </div>
    </div>
  );
}
