import { Suspense } from "react";
import type { Metadata } from "next";
import { getSharedWorkspace, previewDescription } from "@/lib/shared-workspace";
import { SharedSurface } from "./_components/SharedSurface";
import SharedLinkNotFound from "./not-found";

// Link previews (Slack, WhatsApp, X...) show the workspace's own name and description; the
// preview image comes from opengraph-image.tsx next to this file. Shared links are unguessable
// but public, so they stay out of search engines either way.
export async function generateMetadata({ params }: PageProps<"/shared/[token]">): Promise<Metadata> {
  const { token } = await params;
  const workspace = await getSharedWorkspace(token);
  const robots = { index: false, follow: false };
  if (!workspace) return { title: "Link unavailable · Outpost", robots };

  const title = `${workspace.name} · Outpost`;
  const description = previewDescription(workspace);
  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: "website", siteName: "Outpost" },
    // No image here: X falls back to the og:image, which opengraph-image.tsx provides.
    twitter: { card: "summary_large_image", title, description },
  };
}

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
  const workspace = await getSharedWorkspace(token);
  // Render the unavailable screen directly: throwing notFound() from inside this streamed
  // <Suspense> boundary crashes the page on the client in production builds (React #419/#441)
  // instead of showing not-found.tsx. The response is already a 200 with noindex either way.
  if (!workspace) return <SharedLinkNotFound />;

  return (
    <SharedSurface
      name={workspace.name}
      description={workspace.description}
      doc={workspace.doc}
      canvas={workspace.canvas}
    />
  );
}

function SharedSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background" aria-hidden>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 px-4">
        <div className="size-6 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <span className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
      </div>
    </div>
  );
}
