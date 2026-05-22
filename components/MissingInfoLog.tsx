"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { MissingInfoItem, MissingInfoOwner } from "@/lib/types";

type Props = {
  items: MissingInfoItem[];
};

const OWNER_COLORS: Record<MissingInfoOwner, string> = {
  customer: "bg-blue-100 text-blue-800 border-blue-200",
  product: "bg-purple-100 text-purple-800 border-purple-200",
  engineering: "bg-orange-100 text-orange-800 border-orange-200",
  security: "bg-red-100 text-red-800 border-red-200",
  commercial: "bg-green-100 text-green-800 border-green-200",
  unknown: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export function MissingInfoLog({ items }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="No open items"
        body="Discovery looks complete. Nothing blocks the next phase."
      />
    );
  }

  const byOwner: Partial<Record<MissingInfoOwner, MissingInfoItem[]>> = {};
  for (const item of items) {
    if (!byOwner[item.suggestedOwner]) byOwner[item.suggestedOwner] = [];
    byOwner[item.suggestedOwner]!.push(item);
  }

  const owners = Object.keys(byOwner) as MissingInfoOwner[];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {items.length} open item{items.length !== 1 ? "s" : ""} need attention
        before pilot launch.
      </p>
      {owners.map((owner) => (
        <section key={owner} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs capitalize", OWNER_COLORS[owner])}
            >
              {owner}
            </Badge>
            <span className="font-normal">
              ({byOwner[owner]!.length} item
              {byOwner[owner]!.length !== 1 ? "s" : ""})
            </span>
          </h3>
          <div className="space-y-2">
            {byOwner[owner]!.map((item) => (
              <Surface key={item.id} className="px-4 py-3 space-y-1">
                <p className="text-sm font-medium">{item.item}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.whyItMatters}
                </p>
              </Surface>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
