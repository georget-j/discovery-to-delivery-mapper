"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import {
  createBlankProject,
  saveProject,
  registerLocalProject,
} from "@/lib/project-store";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
};

// Lightweight modal that asks for an initial project name, then mints a
// blank project (id `local-<random>`), persists it to localStorage,
// registers it in the local-project index, and navigates to its workspace.
export function NewProjectButton({
  className,
  label = "Start blank project",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const project = createBlankProject(name);
      saveProject(project);
      registerLocalProject(project.id);
      // Close the modal before navigating so the button never gets stuck on
      // "Creating…" if client navigation is slow or interrupted.
      setOpen(false);
      router.push(`/workspace/${project.id}/intake`);
    } catch {
      // Surface the failure instead of leaving the button spinning forever.
      setSubmitting(false);
      setOpen(false);
    } finally {
      // Reset shortly after so a returning modal starts clean even if the
      // route transition kept this component mounted.
      setTimeout(() => setSubmitting(false), 1500);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant: "outline" }), className)}
      >
        + {label}
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Create a blank project"
        dismissOnBackdrop
      >
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">Start a blank project</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stored locally in this browser. You can rename it any time from
              the workspace.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-xs">
              Project / customer name
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meridian Bank"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground/80">
              Optional — leave blank to start as "Untitled Project".
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create project →"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
