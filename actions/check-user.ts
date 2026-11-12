"use server";

import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Looks up the local User row by clerkId, creating it on first sight.
// Plans and subscriptions live in Clerk, not here.
//
// The session (auth()) is read locally from the token, while currentUser() is a Clerk API round
// trip, so the profile is only fetched the first time a user is seen. Deduplicated per request.
const findOrCreateUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const profile = {
    email,
    name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null,
    imageUrl: clerkUser.imageUrl,
  };
  // Upsert: two first requests at once (e.g. the page and a header action) would otherwise race
  // to create the same row and one would fail on the unique clerkId.
  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {},
    create: { clerkId: clerkUser.id, ...profile },
  });
});

export async function checkUser() {
  return findOrCreateUser();
}
