"use client";

import { Toaster } from "sonner";
import { useIsMobile } from "@/lib/use-media-query";

// Sonner doesn't have responsive positioning built in. On mobile, position
// the stack at top-center so it doesn't collide with the iOS home indicator
// or the artifact picker bottom-sheet. On desktop, keep bottom-right.
export function ResponsiveToaster() {
  const isMobile = useIsMobile();
  return (
    <Toaster
      position={isMobile ? "top-center" : "bottom-right"}
      richColors
      closeButton
      offset={isMobile ? 16 : undefined}
    />
  );
}
