import { Surface } from "@/components/ui/surface";

export default function DiscoveryLoading() {
  return (
    <div
      className="p-8 space-y-6 max-w-4xl"
      aria-busy="true"
      aria-label="Loading discovery form"
    >
      <div className="space-y-2">
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-muted/60 animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Surface key={i} className="px-4 py-4 space-y-3">
          <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
            <div className="h-8 rounded bg-muted/50 animate-pulse sm:col-span-2" />
          </div>
        </Surface>
      ))}
    </div>
  );
}
