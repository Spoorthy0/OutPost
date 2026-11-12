import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { workspaceOwnerSelect } from "@/lib/billing";

// The orgs a user belongs to. The session only knows the active org, so links into another org
// need the full list. Deduplicated within a request.
const getMembershipOrgIds = cache(async (userId: string) => {
  const clerk = await clerkClient();
  const { data: memberships } = await clerk.users.getOrganizationMembershipList({ userId, limit: 100 });
  return new Set(memberships.map((m) => m.organization.id));
});

// Org workspaces are open to every member of that org; personal (org-less) ones only to their
// creator. Deduplicated within a request, since a page and its components often check the same one.
export const canAccessWorkspace = cache(async (workspaceId: string) => {
  const { userId, orgId } = await auth();
  if (!userId) return false;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: workspaceOwnerSelect,
  });
  if (!workspace) return false;

  if (!workspace.clerkOrgId) return workspace.creator.clerkId === userId;
  if (workspace.clerkOrgId === orgId) return true;
  return (await getMembershipOrgIds(userId)).has(workspace.clerkOrgId);
});
