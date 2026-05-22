import { Surface } from "@/components/ui/surface";

export default function RisksLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-5xl"
      aria-busy="true"
      aria-label="Loading risk register"
    >
      <div className="space-y-2">
        <div className="h-5 w-44 rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted/60 animate-pulse" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-16 rounded-full bg-muted/60 animate-pulse"
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Surface key={i} className="px-4 py-3 flex items-start gap-3">
            <div className="h-5 w-14 rounded bg-muted animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 rounded bg-muted/70 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded bg-muted/40 animate-pulse" />
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}
