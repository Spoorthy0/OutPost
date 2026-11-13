import "server-only";
import { cache } from "react";
import type { TLEditorSnapshot } from "tldraw";
import type { PartialBlock } from "@blocknote/core";
import { prisma } from "@/lib/prisma";
import { getEntitlements, workspaceOwnerId, workspaceOwnerSelect } from "@/lib/billing";

export type SharedWorkspace = {
  name: string;
  description: string | null;
  doc: PartialBlock[] | null;
  canvas: TLEditorSnapshot | null;
};

// The workspace behind a share link, or null when the link is unknown, was turned off or reset,
// or the owner's plan no longer includes public sharing. Wrapped in cache() so the page, its
// metadata and its preview image share one lookup per request.
export const getSharedWorkspace = cache(async (token: string): Promise<SharedWorkspace | null> => {
  if (!token) return null;
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
  if (!workspace) return null;

  const { publicSharing } = await getEntitlements(workspaceOwnerId(workspace));
  if (!publicSharing) return null;

  const doc = workspace.doc?.content as PartialBlock[] | null | undefined;
  const canvas = workspace.canvas?.content as TLEditorSnapshot | null | undefined;
  return {
    name: workspace.name,
    description: workspace.description,
    doc: Array.isArray(doc) && doc.length > 0 ? doc : null,
    canvas: canvas && hasShapes(canvas) ? canvas : null,
  };
});

// A canvas that was drawn on and then cleared still has a snapshot, just without shapes.
function hasShapes(snapshot: TLEditorSnapshot) {
  const records = snapshot.document?.store;
  return !!records && Object.values(records).some((record) => record?.typeName === "shape");
}

// For link previews: the description, or else the first lines of the doc's text.
export function previewDescription(workspace: SharedWorkspace, maxLength = 180) {
  const text = workspace.description?.trim() || docText(workspace.doc);
  if (!text) return "A shared workspace on Outpost: a doc and a canvas, drawn and written with an AI agent.";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…` : text;
}

function docText(blocks: PartialBlock[] | null) {
  if (!blocks) return "";
  const parts: string[] = [];
  const walk = (content: unknown) => {
    if (typeof content === "string") parts.push(content);
    else if (Array.isArray(content)) content.forEach(walk);
    else if (content && typeof content === "object" && "text" in content) parts.push(String(content.text));
  };
  for (const block of blocks) {
    walk(block.content);
    if (parts.join(" ").length > 400) break;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
