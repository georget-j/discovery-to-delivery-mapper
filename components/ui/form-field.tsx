"use client";

import { useState, useRef, type ReactNode, type KeyboardEvent } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── FormField ──────────────────────────────────────────────────────────────
// Wrapper around an input that pairs persistent label + helper text + control.
// Helper text is OUTSIDE the input (per NN/G guidance — placeholder text alone
// causes accessibility and usability problems).

type FormFieldProps = {
  id?: string;
  label: string;
  helper?: string;
  optional?: boolean;
  required?: boolean;
  error?: string;
  /** Optional InfoTip (or any node) rendered inline after the label. */
  infoTip?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FormField({
  id,
  label,
  helper,
  optional,
  required,
  error,
  infoTip,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label
          htmlFor={id}
          className="text-xs font-medium inline-flex items-center gap-1.5"
        >
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
          {infoTip && <span className="not-italic">{infoTip}</span>}
        </Label>
        {optional && (
          <span className="text-[10px] text-muted-foreground/60 italic">
            Optional
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : helper ? (
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

// ── ChipInput ──────────────────────────────────────────────────────────────
// Replaces newline/comma-separated textareas for arrays. Type and press Enter
// (or comma) to add. Click × to remove. Backspace on empty removes last chip.

type ChipInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[]; // optional quick-add buttons
  maxChips?: number;
  ariaLabel?: string;
};

export function ChipInput({
  value,
  onChange,
  placeholder,
  suggestions,
  maxChips,
  ariaLabel,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const cleaned = raw.trim().replace(/,$/, "").trim();
    if (!cleaned) return;
    if (value.some((v) => v.toLowerCase() === cleaned.toLowerCase())) {
      setDraft("");
      return;
    }
    if (maxChips && value.length >= maxChips) return;
    onChange([...value, cleaned]);
    setDraft("");
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  };

  const atMax = maxChips ? value.length >= maxChips : false;

  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label={ariaLabel ?? "Tag input"}
      >
        {value.map((chip, i) => (
          <span
            key={`${chip}-${i}`}
            className="inline-flex items-center gap-1 bg-muted/60 border border-border rounded-md px-2 py-0.5 text-xs"
          >
            <span>{chip}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
              className="text-muted-foreground hover:text-foreground -mr-1 ml-0.5 text-xs leading-none"
              aria-label={`Remove ${chip}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={atMax}
          className="flex-1 min-w-[100px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
        />
      </div>

      {suggestions && suggestions.length > 0 && !atMax && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter(
              (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
            )
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => commit(s)}
                className="text-[11px] px-1.5 py-0.5 rounded border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── FieldGroup ─────────────────────────────────────────────────────────────
// Collapsible section with title + optional helper. Supports controlled or
// uncontrolled open state.

type FieldGroupProps = {
  title: string;
  helper?: string;
  defaultOpen?: boolean;
  status?: ReactNode; // e.g. "3 of 5 complete"
  children: ReactNode;
};

export function FieldGroup({
  title,
  helper,
  defaultOpen = true,
  status,
  children,
}: FieldGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {helper && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {helper}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {status && (
            <div className="text-[11px] text-muted-foreground">{status}</div>
          )}
          <span className="text-muted-foreground">{open ? "−" : "+"}</span>
        </div>
      </button>
      {open && <div className="border-t px-4 py-4 space-y-4">{children}</div>}
    </section>
  );
}
