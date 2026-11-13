import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { checkUser } from "@/actions/check-user";
import { prisma } from "@/lib/prisma";
import { getWorkspaceScope } from "@/lib/workspace-scope";
import { WORKSPACE_STATUSES, withLastActivity, workspaceCardSelect } from "@/lib/workspace-status";
import { Button } from "@/components/ui/button";
import { WorkspaceDialog } from "@/components/WorkspaceDialog";
import { WorkspaceBoard } from "./_components/WorkspaceBoard";

// With cacheComponents on, reading the request (checkUser and getWorkspaceScope use Clerk's session)
// must happen inside <Suspense>, so the skeleton shows instantly and the board streams in.
export default function WorkspacesPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-10 md:px-8">
      <Suspense fallback={<WorkspacesSkeleton />}>
        <Workspaces />
      </Suspense>
    </div>
  );
}

function WorkspacesSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-44 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {WORKSPACE_STATUSES.map((column) => (
          <div key={column.status} className="h-64 animate-pulse rounded-2xl border border-white/6 bg-white/3" />
        ))}
      </div>
    </div>
  );
}

async function Workspaces() {
  const user = await checkUser();
  if (!user) redirect("/sign-in");

  const scope = await getWorkspaceScope(user.id);
  const [orgName, workspaces] = await Promise.all([
    scope.orgName,
    prisma.workspace.findMany({
      where: scope.where,
      select: { ...workspaceCardSelect, position: true },
      orderBy: { position: "asc" },
    }),
  ]);

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground/80 uppercase">{orgName}</p>
          <h1 className="text-heading-fade mt-1.5 text-3xl font-semibold tracking-[-0.03em]">All workspaces</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Drag cards between columns as work moves.</p>
        </div>
        <WorkspaceDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              New workspace
            </Button>
          }
        />
      </div>

      {workspaces.length === 0 ? (
        <div className="bg-dots flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
            <Plus className="size-5" />
          </span>
          <p className="mt-4 font-medium">No workspaces yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Start one from the dashboard or with New workspace.</p>
        </div>
      ) : (
        <WorkspaceBoard workspaces={workspaces.map(withLastActivity)} />
      )}
    </>
  );
}