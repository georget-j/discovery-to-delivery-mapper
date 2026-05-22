import { Surface } from "@/components/ui/surface";

export default function PilotLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-4xl"
      aria-busy="true"
      aria-label="Loading pilot plan"
    >
      <div className="space-y-2">
        <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted/60 animate-pulse" />
      </div>
      <Surface variant="muted" className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          <div className="h-3 w-48 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="h-1.5 rounded-full bg-muted animate-pulse" />
      </Surface>
      {Array.from({ length: 3 }).map((_, i) => (
        <Surface key={i} className="px-4 py-4 space-y-3">
          <div className="h-3 w-1/4 rounded bg-muted animate-pulse" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
          </div>
        </Surface>
      ))}
    </div>
  );
}
