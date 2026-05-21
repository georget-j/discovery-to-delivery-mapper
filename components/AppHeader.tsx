"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();

  const nav = [
    { href: "/", label: "Home" },
    { href: "/scenarios", label: "Scenarios" },
  ];

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 flex h-14 items-center gap-3 sm:gap-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-sm shrink-0"
        >
          <span className="text-primary">⬡</span>
          <span className="hidden sm:inline">Discovery to Delivery Mapper</span>
          <span className="sm:hidden">D→D Mapper</span>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname === href
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Portfolio Demo
          </span>
        </div>
      </div>
    </header>
  );
}
