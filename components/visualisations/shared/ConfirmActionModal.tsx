"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
};

// Shared confirm dialog for destructive canvas actions (regenerate over
// manual edits, reset). Escape and Cancel both mean "do nothing" — unlike
// window.confirm, dismissal can never be the destructive path.
export function ConfirmActionModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} ariaLabel={title}>
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
