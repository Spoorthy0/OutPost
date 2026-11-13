"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { deleteWorkspace, moveWorkspace } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";
import type { WorkspaceStatus } from "@/lib/generated/prisma/enums";
import { WORKSPACE_STATUSES } from "@/lib/workspace-status";
import { WorkspaceDialog } from "@/components/WorkspaceDialog";
import { WorkspaceCard, type WorkspaceCardData } from "@/components/WorkspaceCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BoardWorkspace = WorkspaceCardData & { position: number };

function columnItems(workspaces: BoardWorkspace[], status: WorkspaceStatus) {
  return workspaces.filter((w) => w.status === status).sort((a, b) => a.position - b.position);
}

// Midpoint between the new neighbors, so only the dropped card needs saving.
function positionBetween(before?: BoardWorkspace, after?: BoardWorkspace) {
  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position + 1;
  if (after) return after.position - 1;
  return 0;
}

export function WorkspaceBoard({ workspaces }: { workspaces: BoardWorkspace[] }) {
  const [items, setItems] = useState(workspaces);

  // Re-sync when the server sends a fresh list (e.g. after creating a workspace).
  const [prevWorkspaces, setPrevWorkspaces] = useState(workspaces);
  if (workspaces !== prevWorkspaces) {
    setPrevWorkspaces(workspaces);
    setItems(workspaces);
  }

  // `selected` outlives the open flag, so dialog text doesn't blank out during the close animation.
  const [selected, setSelected] = useState<BoardWorkspace | null>(null);
  const [openDialog, setOpenDialog] = useState<"edit" | "delete" | null>(null);
  const { fn: deleteWorkspaceFn, loading: isDeleting } = useFetch(deleteWorkspace);

  const openFor = (workspace: BoardWorkspace, dialog: "edit" | "delete") => {
    setSelected(workspace);
    setOpenDialog(dialog);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    // Keep the dialog open until the delete finishes (AlertDialogAction closes it by default).
    e.preventDefault();
    if (!selected || isDeleting) return;
    const deleted = await deleteWorkspaceFn(selected.id);
    // On failure useFetch has shown the error; keep the dialog open so the user can retry.
    if (!deleted) return;
    const deletedId = selected.id;
    setItems((current) => current.filter((w) => w.id !== deletedId));
    setOpenDialog(null);
    toast.success("Workspace deleted");
  };

  const handleDragEnd = async ({ draggableId, source, destination }: DropResult) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const status = destination.droppableId as WorkspaceStatus;
    const target = columnItems(items, status).filter((w) => w.id !== draggableId);
    const position = positionBetween(target[destination.index - 1], target[destination.index]);

    const previous = items;
    setItems(items.map((w) => (w.id === draggableId ? { ...w, status, position } : w)));

    try {
      await moveWorkspace(draggableId, status, position);
    } catch {
      setItems(previous);
      toast.error("Couldn't move workspace");
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {WORKSPACE_STATUSES.map((column) => {
          const columnWorkspaces = columnItems(items, column.status);
          return (
            <div
              key={column.status}
              className="flex flex-col rounded-2xl border border-white/6 bg-[linear-gradient(180deg,oklch(1_0_0/0.035),oklch(1_0_0/0.012))] shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]"
            >
              <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-foreground/80 uppercase">
                <span className={`size-2 rounded-full ${column.dot}`} />
                {column.title}
                <span className="ml-auto rounded-full bg-white/6 px-2 py-0.5 font-mono text-[10px] font-normal text-muted-foreground tabular-nums">
                  {columnWorkspaces.length}
                </span>
              </div>
              <Droppable droppableId={column.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`m-1.5 mt-0 flex min-h-40 flex-1 flex-col gap-2 rounded-xl p-1.5 transition-colors ${
                      snapshot.isDraggingOver ? "bg-primary/6 ring-1 ring-primary/25 ring-inset" : ""
                    }`}
                  >
                    {columnWorkspaces.map((workspace, index) => (
                      <Draggable key={workspace.id} draggableId={workspace.id} index={index}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                            <WorkspaceCard
                              workspace={workspace}
                              highlighted={snapshot.isDragging}
                              actions={
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Workspace options"
                                      className="absolute top-2.5 right-2.5 z-10 size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => openFor(workspace, "edit")}>
                                      <Pencil className="size-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem variant="destructive" onSelect={() => openFor(workspace, "delete")}>
                                      <Trash2 className="size-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              }
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>

      {selected && (
        <WorkspaceDialog
          workspace={selected}
          open={openDialog === "edit"}
          onOpenChange={(open) => !open && setOpenDialog(null)}
        />
      )}

      <AlertDialog open={openDialog === "delete"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{selected?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the workspace, including its doc and canvas. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={!!isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DragDropContext>
  );
}