// Thin wrapper around sonner so the codebase only imports from one place.
// Keeps usage stable if we ever swap the underlying library.
//
// Toasts are reserved for cross-component or async actions. Inline form
// auto-saves still use the local <SaveIndicator/> chip to avoid one toast
// per keystroke (see [[ux:firstRunSeen]] convention in components/ui/save-indicator).

import { toast as sonner } from "sonner";

export const toast = {
  success: (message: string, opts?: { description?: string }) =>
    sonner.success(message, opts),
  error: (message: string, opts?: { description?: string }) =>
    sonner.error(message, opts),
  info: (message: string, opts?: { description?: string }) =>
    sonner(message, opts),
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) => sonner.promise(promise, messages),
};

export type Toast = typeof toast;
