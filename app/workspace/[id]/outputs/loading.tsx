import { Surface } from "@/components/ui/surface";

export default function OutputsLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-6xl"
      aria-busy="true"
      aria-label="Loading deployment pack"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-4">
        <Surface className="hidden md:block w-52 py-2 px-2 space-y-1.5 shrink-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-muted/50 animate-pulse" />
          ))}
        </Surface>
        <Surface className="flex-1 px-6 py-6 space-y-3">
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-muted/50 animate-pulse"
              style={{ width: `${85 - i * 4}%` }}
            />
          ))}
        </Surface>
      </div>
    </div>
  );
}
