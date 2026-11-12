"use server";

import { auth } from "@clerk/nextjs/server";
import { getPromptUsage, getWorkspaceOwnerId } from "@/lib/billing";
import { canAccessWorkspace } from "@/lib/workspace-access";

// Prompt usage for the header pill. Inside a workspace, prompts count against that workspace's
// owner, which isn't always the org selected in the switcher; elsewhere, the selected org or the
// personal account.
export async function getActivePromptUsage(workspaceId?: string) {
  const { userId, orgId } = await auth();
  if (!userId) return null;
  if (workspaceId) {
    if (!(await canAccessWorkspace(workspaceId))) return null;
    return getPromptUsage(await getWorkspaceOwnerId(workspaceId));
  }
  return getPromptUsage(orgId ?? userId);
}
