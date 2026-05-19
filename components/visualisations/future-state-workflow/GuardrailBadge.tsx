"use client";

export function GuardrailBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-pink-50 text-pink-800 border-pink-200">
      <span>🛡</span>
      <span>{label}</span>
    </span>
  );
}
