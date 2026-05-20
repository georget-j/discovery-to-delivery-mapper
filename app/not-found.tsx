import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-5xl">404</p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist. If you came from a saved scenario, it may have been removed.
        </p>
        <div className="pt-2">
          <Link
            href="/scenarios"
            className="text-sm px-4 py-2 rounded-md border hover:bg-muted/50 transition-colors inline-block"
          >
            Browse scenarios
          </Link>
        </div>
      </div>
    </div>
  );
}
