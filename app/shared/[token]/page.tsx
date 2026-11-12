import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { TLEditorSnapshot } from "tldraw";
import type { PartialBlock } from "@blocknote/core";
import { prisma } from "@/lib/prisma";
import { getEntitlements, workspaceOwnerId, workspaceOwnerSelect } from "@/lib/billing";
import { SharedSurface } from "./_components/SharedSurface";

// Shared links are unguessable but public: keep them out of search engines.
export const metadata: Metadata = {
  title: "Shared workspace · Outpost",
  robots: { index: false, follow: false },
};

// Public, read-only view of a workspace, opened from its share link without signing in.
// With cacheComponents on, reading params happens inside <Suspense>.
export default function SharedWorkspacePage({ params }: PageProps<"/shared/[token]">) {
  return (
    <Suspense fallback={<SharedSkeleton />}>
      <SharedWorkspace params={params} />
    </Suspense>
  );
}

async function SharedWorkspace({ params }: Pick<PageProps<"/shared/[token]">, "params">) {
  const { token } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      description: true,
      doc: { select: { content: true } },
      canvas: { select: { content: true } },
      ...workspaceOwnerSelect,
    },
  });
  if (!workspace) notFound();

  // A link stops working if the owner's plan no longer includes public sharing.
  const { publicSharing } = await getEntitlements(workspaceOwnerId(workspace));
  if (!publicSharing) notFound();

  const doc = workspace.doc?.content as PartialBlock[] | null | undefined;
  const canvas = workspace.canvas?.content as TLEditorSnapshot | null | undefined;

  return (
    <SharedSurface
      name={workspace.name}
      description={workspace.description}
      doc={Array.isArray(doc) && doc.length > 0 ? doc : null}
      canvas={canvas && hasShapes(canvas) ? canvas : null}
    />
  );
}

// A canvas that was drawn on and then cleared still has a snapshot, just without shapes.
function hasShapes(snapshot: TLEditorSnapshot) {
  const records = snapshot.document?.store;
  return !!records && Object.values(records).some((record) => record?.typeName === "shape");
}

function SharedSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background" aria-hidden>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 px-4">
        <div className="size-6 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1" />
    </div>
  );
}
