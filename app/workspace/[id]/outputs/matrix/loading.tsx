import { Surface } from "@/components/ui/surface";

export default function CoverageMatrixLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-6xl"
      aria-busy="true"
      aria-label="Loading coverage matrix"
    >
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
        <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-muted/60 animate-pulse" />
      </div>
      <Surface className="p-4">
        <div className="grid grid-cols-9 gap-2">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </Surface>
    </div>
  );
}
