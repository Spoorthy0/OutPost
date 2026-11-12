import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { TLEditorSnapshot } from "tldraw";
import type { PartialBlock } from "@blocknote/core";
import { checkUser } from "@/actions/check-user";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/workspace-access";
import { getEntitlements, getPromptUsage, workspaceOwnerId, workspaceOwnerSelect } from "@/lib/billing";
import { WorkspaceEditorsProvider } from "@/components/WorkspaceEditorsContext";
import { WorkspaceSurface } from "./_components/WorkspaceSurface";
import { EditableWorkspaceName } from "./_components/EditableWorkspaceName";
import { ShareDialog } from "./_components/ShareDialog";
import { AgentToggleButton } from "./_components/AgentToggleButton";
import { PlanButton } from "@/components/PlanButton";

// With cacheComponents on, reading the request (params, the Clerk session) happens inside
// <Suspense>, so the shell shows instantly and the workspace streams in.
export default function WorkspacePage({ params, searchParams }: PageProps<"/workspace/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Workspace params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Workspace({ params, searchParams }: PageProps<"/workspace/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  // Independent lookups run together; the workspace's content is only rendered once access is confirmed.
  const [user, allowed, workspace] = await Promise.all([
    checkUser(),
    canAccessWorkspace(id),
    prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        shareToken: true,
        // The Yjs state is the doc's source of truth; the JSON copy is only needed for docs saved
        // before collaboration existed, so it's sent only when there's no Yjs state yet.
        doc: { select: { content: true, yjsState: true } },
        canvas: { select: { content: true } },
        ...workspaceOwnerSelect,
      },
    }),
  ]);
  if (!user) redirect("/sign-in");
  if (!allowed || !workspace) notFound();

  const ownerId = workspaceOwnerId(workspace);
  const entitlements = await getEntitlements(ownerId);
  const usage = await getPromptUsage(ownerId, entitlements);
  const { publicSharing, pdfExport } = entitlements;
  const initialPrompt = typeof query.prompt === "string" && query.prompt.trim() ? query.prompt : undefined;
  const yjsState = workspace.doc?.yjsState;

  return (
    // Keyed by id so moving between workspaces starts fresh editors and a fresh agent chat.
    <WorkspaceEditorsProvider key={workspace.id}>
      <WorkspaceSurface
        workspaceId={workspace.id}
        initialDoc={yjsState ? null : ((workspace.doc?.content as PartialBlock[] | null) ?? null)}
        initialDocState={yjsState ? Buffer.from(yjsState).toString("base64") : null}
        initialCanvas={(workspace.canvas?.content as TLEditorSnapshot | null) ?? null}
        startInBothView={!!initialPrompt}
        left={
          <>
            <Link
              href="/dashboard"
              aria-label="Back to dashboard"
              className="group flex h-8 items-center gap-1 rounded-md pr-1.5 pl-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
              <Image src="/brand/mascot.png" alt="Outpost" width={20} height={20} className="size-5" />
            </Link>
            <span className="h-5 w-px shrink-0 bg-white/10" />
            <EditableWorkspaceName workspaceId={workspace.id} initialName={workspace.name} />
          </>
        }
        right={
          <>
            <PlanButton workspaceId={workspace.id} initialUsage={usage} upgradeOnlyWhenOut />
            <ShareDialog
              workspaceId={workspace.id}
              workspaceName={workspace.name}
              initialShareToken={workspace.shareToken}
              canShare={publicSharing}
              canExportPdf={pdfExport}
            />
            <AgentToggleButton workspaceId={workspace.id} initialPrompt={initialPrompt} />
          </>
        }
      />
    </WorkspaceEditorsProvider>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background" aria-hidden>
      <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/8 px-3">
        <div className="flex items-center gap-2">
          <div className="size-7 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-7 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="flex justify-end gap-2">
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="flex flex-1">
        <div className="w-[42%] space-y-4 border-r border-white/8 bg-card/40 p-14">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70" />
          <div className="h-3 w-4/6 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
        </div>
      </div>
    </div>
  );
}
