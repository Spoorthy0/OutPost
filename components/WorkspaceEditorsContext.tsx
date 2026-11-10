"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Editor } from "tldraw";
import type { BlockNoteEditor } from "@blocknote/core";

// The live canvas (tldraw) and doc (BlockNote) editors of the open workspace. Each editor
// registers itself on mount and clears itself on unmount, so a null editor means that surface
// isn't on screen in the current view. The agent, share/export dialog and header read from here.
export type DocEditor = BlockNoteEditor;

type WorkspaceEditors = {
  canvasEditor: Editor | null;
  docEditor: DocEditor | null;
  setCanvasEditor: (editor: Editor | null) => void;
  setDocEditor: (editor: DocEditor | null) => void;
};

const WorkspaceEditorsContext = createContext<WorkspaceEditors | null>(null);

export function WorkspaceEditorsProvider({ children }: { children: ReactNode }) {
  const [canvasEditor, setCanvasEditor] = useState<Editor | null>(null);
  const [docEditor, setDocEditor] = useState<DocEditor | null>(null);

  const value = useMemo(
    () => ({ canvasEditor, docEditor, setCanvasEditor, setDocEditor }),
    [canvasEditor, docEditor]
  );

  return <WorkspaceEditorsContext.Provider value={value}>{children}</WorkspaceEditorsContext.Provider>;
}

export function useWorkspaceEditors() {
  const context = useContext(WorkspaceEditorsContext);
  if (!context) throw new Error("useWorkspaceEditors must be used inside <WorkspaceEditorsProvider>");
  return context;
}
