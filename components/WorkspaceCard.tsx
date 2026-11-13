import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WorkspaceStatus } from "@/lib/generated/prisma/enums";
import { statusDot, statusTitle } from "@/lib/workspace-status";

export type WorkspaceCardData = {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  lastActivity: Date;
  creator: { name: string | null; imageUrl: string | null };
};

// One card for the board and the dashboard's recent list: title, description, and a Jira-style
// footer (last edit on the left, the creator's avatar on the right). `actions` renders over the
// top-right corner, `showStatus` adds the column name (the board already shows it as the column).
export function WorkspaceCard({
  workspace,
  showStatus = false,
  highlighted = false,
  actions,
}: {
  workspace: WorkspaceCardData;
  showStatus?: boolean;
  highlighted?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`edge-glow group relative flex h-40 flex-col gap-1.5 overflow-hidden rounded-xl bg-[linear-gradient(180deg,oklch(0.205_0.006_285),oklch(0.175_0.005_285))] p-4 shadow-[0_8px_24px_-12px_oklch(0_0_0/0.8)] ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-16px_oklch(0_0_0/0.9),0_0_0_1px_oklch(0.74_0.16_55/0.25)] ${
        highlighted ? "rotate-1 shadow-2xl ring-primary/60" : "ring-white/6"
      }`}
    >
      {/* Warm light that fades in on hover, from the top-right corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primary/15 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />

      {showStatus && (
        <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          <span className={`size-1.5 rounded-full ${statusDot(workspace.status)}`} />
          {statusTitle(workspace.status)}
        </span>
      )}

      {/* after:inset-0 stretches the link over the whole card, so `actions` can sit on top
          without being nested inside the link. */}
      <Link
        href={`/workspace/${workspace.id}`}
        draggable={false}
        className="line-clamp-2 pr-7 text-[0.9rem] leading-snug font-semibold tracking-tight transition-colors after:absolute after:inset-0 group-hover:text-white"
      >
        {workspace.name}
      </Link>
      {workspace.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{workspace.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/6 pt-2.5 text-[11px] text-muted-foreground">
        {/* Relative time can differ by a minute between the server and browser render. */}
        <span className="flex min-w-0 items-center gap-1.5" suppressHydrationWarning>
          <Clock className="size-3 shrink-0 text-primary/80" />
          <span className="truncate" suppressHydrationWarning>
            {formatDistanceToNow(workspace.lastActivity, { addSuffix: true })}
          </span>
        </span>
        <CreatorAvatar creator={workspace.creator} />
      </div>

      {actions}
    </div>
  );
}

function CreatorAvatar({ creator }: { creator: WorkspaceCardData["creator"] }) {
  const name = creator.name ?? "Unknown";
  return creator.imageUrl ? (
    <Image
      src={creator.imageUrl}
      alt={name}
      title={name}
      width={20}
      height={20}
      className="size-5 shrink-0 rounded-full ring-2 ring-white/10"
    />
  ) : (
    <span
      title={name}
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,oklch(0.74_0.16_55),oklch(0.6_0.18_35))] text-[10px] font-semibold text-primary-foreground ring-2 ring-white/10"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
