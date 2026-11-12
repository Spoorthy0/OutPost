import { cacheLife, cacheTag } from "next/cache";
import { auth, createClerkClient } from "@clerk/nextjs/server";
import type { Prisma } from "@/lib/generated/prisma/client";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// The active org's workspaces, or the user's personal ones when no org is selected.
export function scopeWhere(orgId: string | null | undefined, userId: string): Prisma.WorkspaceWhereInput {
  return orgId ? { clerkOrgId: orgId } : { clerkOrgId: null, creatorId: userId };
}

// Org names rarely change, and looking one up is a Clerk API round trip on every dashboard and
// board load, so it's cached for an hour.
async function getOrgName(orgId: string) {
  "use cache";
  cacheTag(`org-name:${orgId}`);
  cacheLife("hours");
  try {
    return (await clerk.organizations.getOrganization({ organizationId: orgId })).name;
  } catch {
    cacheLife("seconds");
    return "Organization";
  }
}

// What the dashboard and the board list, plus the name to show above it. `orgName` is a promise,
// so callers can look it up alongside their workspace query instead of before it.
export async function getWorkspaceScope(userId: string) {
  const { orgId } = await auth();
  const orgName = orgId ? getOrgName(orgId) : Promise.resolve("Personal");
  return { orgName, where: scopeWhere(orgId, userId) };
}
