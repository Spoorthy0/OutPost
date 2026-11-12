"use server";

import { updateTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { entitlementsTag } from "@/lib/billing";

// Called right after a checkout finishes, so the new plan's limits apply immediately instead of
// after the entitlements cache's minute runs out. Only the caller's own account (or active org)
// can be refreshed.
export async function refreshEntitlements() {
  const { userId, orgId } = await auth();
  if (!userId) return;
  updateTag(entitlementsTag(userId));
  if (orgId) updateTag(entitlementsTag(orgId));
}
