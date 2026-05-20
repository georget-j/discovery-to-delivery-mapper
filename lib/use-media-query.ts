"use client";

import { useEffect, useState } from "react";

// Tailwind's `md:` breakpoint = 768px. Mobile = below that.
const MOBILE_MAX = 767.98;

// SSR-safe media query hook. Always returns `false` on first render to match
// the server (which has no viewport) — components that need different markup
// must accept this. For purely presentational responsiveness, prefer Tailwind
// `md:` classes; this hook is for when JS state has to branch (e.g. open vs
// closed inspector default).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_MAX}px)`);
}
