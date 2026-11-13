import type { WorkspaceStatus } from "@/lib/generated/prisma/enums";

// Board columns, in order. Shared by the kanban board and the recent workspace cards.
// `dot` is the status color: full Tailwind class names, so the scanner picks them up.
export const WORKSPACE_STATUSES: { status: WorkspaceStatus; title: string; dot: string }[] = [
  { status: "PLANNING", title: "Planning", dot: "bg-sky-400 shadow-[0_0_8px] shadow-sky-400/60" },
  { status: "IN_PROGRESS", title: "In progress", dot: "bg-primary shadow-[0_0_8px] shadow-primary/60" },
  { status: "IN_REVIEW", title: "In review", dot: "bg-violet-400 shadow-[0_0_8px] shadow-violet-400/60" },
  { status: "DONE", title: "Done", dot: "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" },
];

export function statusDot(status: WorkspaceStatus) {
  return WORKSPACE_STATUSES.find((s) => s.status === status)?.dot ?? "bg-muted-foreground";
}

export function statusTitle(status: WorkspaceStatus) {
  return WORKSPACE_STATUSES.find((s) => s.status === status)?.title ?? status;
}

// Fields every workspace card needs, including what withLastActivity reads.
export const workspaceCardSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  updatedAt: true,
  creator: { select: { name: true, imageUrl: true } },
  doc: { select: { updatedAt: true } },
  canvas: { select: { updatedAt: true } },
} as const;

type Dated = { updatedAt: Date } | null;

// A workspace's own updatedAt only changes on rename or move, so real activity also counts
// edits to its doc and canvas.
export function withLastActivity<T extends { updatedAt: Date; doc: Dated; canvas: Dated }>(workspace: T) {
  const lastActivity = [workspace.updatedAt, workspace.doc?.updatedAt, workspace.canvas?.updatedAt]
    .filter((date): date is Date => date !== undefined)
    .reduce((latest, date) => (date > latest ? date : latest));
  return { ...workspace, lastActivity };
}