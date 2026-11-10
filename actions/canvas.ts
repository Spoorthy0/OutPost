"use server";

import { canAccessWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// Autosaved (debounced) from the canvas editor. Live collaboration runs through the tldraw sync
// room; this Postgres copy seeds empty rooms and feeds server-side features like share links.
export async function saveCanvasContent(workspaceId: string, content: Prisma.InputJsonValue) {
  if (!(await canAccessWorkspace(workspaceId))) throw new Error("Workspace not found");

  await prisma.canvas.upsert({
    where: { workspaceId },
    update: { content },
    create: { workspaceId, content },
  });
}
