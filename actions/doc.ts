"use server";

import { canAccessWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// Autosaved (debounced) from the doc editor as BlockNote block JSON.
export async function saveDocContent(workspaceId: string, content: Prisma.InputJsonValue) {
  if (!(await canAccessWorkspace(workspaceId))) throw new Error("Workspace not found");

  await prisma.doc.upsert({
    where: { workspaceId },
    update: { content },
    create: { workspaceId, content },
  });
}
