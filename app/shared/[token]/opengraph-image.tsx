import { ImageResponse } from "next/og";
import { SharedPreviewCard } from "@/components/SharedPreviewCard";
import { getSharedWorkspace, previewDescription } from "@/lib/shared-workspace";

// The card shown when a share link is pasted into Slack, WhatsApp, X, LinkedIn and the like.

export const alt = "A shared Outpost workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : text;
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const workspace = await getSharedWorkspace(token);

  // An unavailable link still gets a tidy, generic card rather than a broken image.
  const name = workspace ? clip(workspace.name, 70) : "Shared workspace";
  const description = workspace ? clip(previewDescription(workspace, 160), 160) : "This link is no longer available.";
  const surfaces = workspace
    ? [workspace.doc && "Doc", workspace.canvas && "Canvas"].filter((s): s is string => !!s)
    : [];

  return new ImageResponse(<SharedPreviewCard name={name} description={description} surfaces={surfaces} />, size);
}
