import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { createClerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { FREE_MONTHLY_PROMPTS } from "@/lib/plan-limits";

// A plain backend client (no request context), so it can run inside `use cache` scopes.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Cache tag for an owner's plan, so a finished checkout can refresh it right away.
export function entitlementsTag(ownerId: string) {
  return `entitlements:${ownerId}`;
}

// Paid prompt allowances come from Clerk plan features (checked in order), per member for team plans.
const PROMPT_FEATURES = [
  { feature: "agent_prompts_2000", perMember: 2000 },
  { feature: "agent_prompts_500", perMember: 500 },
];

// Everything is scoped to an "owner": a Clerk org id for org workspaces, or a Clerk user id for
// personal ones. Clerk prefixes its ids, so they can't collide.
export const workspaceOwnerSelect = { clerkOrgId: true, creator: { select: { clerkId: true } } } as const;

export function workspaceOwnerId(workspace: { clerkOrgId: string | null; creator: { clerkId: string } }) {
  return workspace.clerkOrgId ?? workspace.creator.clerkId;
}

// Deduplicated within a request (React cache), since several checks need the same owner.
export const getWorkspaceOwnerId = cache(async (workspaceId: string) => {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: workspaceOwnerSelect });
  return workspaceOwnerId(workspace);
});

// The owner's plan features, looked up from Clerk on the server. This works for any owner, not
// just the org selected in the viewer's switcher, and even for signed-out viewers (shared links).
// Every page, header pill and agent prompt needs this, and each lookup is one or two Clerk API
// round trips, so it's cached for a minute across requests. A finished checkout refreshes it
// immediately (see actions/billing.ts); other plan changes show up within a minute.
export async function getEntitlements(ownerId: string) {
  "use cache";
  cacheTag(entitlementsTag(ownerId));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const isOrg = ownerId.startsWith("org_");
  const features = new Set<string>();
  let planName = "Free";

  try {
    const subscription = isOrg
      ? await clerk.billing.getOrganizationBillingSubscription(ownerId)
      : await clerk.billing.getUserBillingSubscription(ownerId);
    for (const item of subscription.subscriptionItems) {
      // past_due keeps access while Clerk retries the payment.
      if (item.status === "active" || item.status === "past_due") {
        item.plan?.features.forEach((feature) => features.add(feature.slug));
        if (item.plan && !item.plan.isDefault) planName = item.plan.name;
      }
    }
  } catch (error) {
    // No subscription (or Clerk unreachable): treat as the free plan. A 404 just means "free";
    // anything else may be a blip, so don't let it pin a paying owner to free for long.
    const status = (error as { status?: number })?.status;
    if (status !== 404) cacheLife("seconds");
  }

  const paid = PROMPT_FEATURES.find(({ feature }) => features.has(feature));
  let promptLimit = FREE_MONTHLY_PROMPTS;
  if (paid) {
    const members = isOrg
      ? ((await clerk.organizations.getOrganization({ organizationId: ownerId, includeMembersCount: true }))
          .membersCount ?? 1)
      : 1;
    promptLimit = paid.perMember * members;
  }

  return {
    isPaid: !!paid,
    planName,
    promptLimit,
    unlimitedWorkspaces: features.has("unlimited_workspaces"),
    publicSharing: features.has("public_sharing"),
    pdfExport: features.has("pdf_export"),
  };
}

function startOfMonthUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function countThisMonth(ownerId: string) {
  return prisma.agentPrompt.count({ where: { ownerId, createdAt: { gte: startOfMonthUtc() } } });
}

export type Entitlements = Awaited<ReturnType<typeof getEntitlements>>;
export type PromptUsage = { ownerId: string; used: number; limit: number; isPaid: boolean; planName: string };

// This month's prompts against the owner's allowance. Pass `entitlements` when the caller
// already has them, to skip a second lookup.
export async function getPromptUsage(ownerId: string, entitlements?: Entitlements): Promise<PromptUsage> {
  const [{ promptLimit, isPaid, planName }, used] = await Promise.all([
    entitlements ?? getEntitlements(ownerId),
    countThisMonth(ownerId),
  ]);
  return { ownerId, used, limit: promptLimit, isPaid, planName };
}

// Takes one prompt from the owner's allowance, or returns null when it's used up. The row is
// written first and the count checked after, so two prompts sent at once can't both slip in
// under the limit (at worst, both are turned away and the user resends one).
export async function reservePrompt(ownerId: string, userId: string, workspaceId: string) {
  const { promptLimit } = await getEntitlements(ownerId);
  const prompt = await prisma.agentPrompt.create({ data: { ownerId, userId, workspaceId }, select: { id: true } });
  if ((await countThisMonth(ownerId)) > promptLimit) {
    await refundPrompt(prompt.id);
    return null;
  }
  return prompt.id;
}

// Gives a prompt back, e.g. when the model failed and the user got nothing for it.
export async function refundPrompt(promptId: string) {
  await prisma.agentPrompt.deleteMany({ where: { id: promptId } });
}

// Tool-result follow-ups are part of a prompt already paid for, so they're free, but only within
// a few minutes of one by the same user in the same workspace. Otherwise a client could skip the
// limit by sending requests that don't end in a user message.
const FOLLOW_UP_WINDOW_MS = 10 * 60 * 1000;

export async function hasRecentPrompt(userId: string, workspaceId: string) {
  const recent = await prisma.agentPrompt.findFirst({
    where: { userId, workspaceId, createdAt: { gte: new Date(Date.now() - FOLLOW_UP_WINDOW_MS) } },
    select: { id: true },
  });
  return !!recent;
}