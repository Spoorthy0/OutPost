"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Editor } from "tldraw";
import type { BlockNoteEditor } from "@blocknote/core";

// The live canvas (tldraw) and doc (BlockNote) editors of the open workspace. Each editor
// registers itself on mount and clears itself on unmount. The agent, share/export dialog and
// header read from here.
//
// A null canvasEditor has two meanings, told apart by canvasVisible: the canvas isn't in the
// current view (false), or it's on screen but still connecting to the sync server (true).
export type DocEditor = BlockNoteEditor;

type WorkspaceEditors = {
  canvasEditor: Editor | null;
  canvasVisible: boolean;
  docEditor: DocEditor | null;
  setCanvasEditor: (editor: Editor | null) => void;
  setCanvasVisible: (visible: boolean) => void;
  setDocEditor: (editor: DocEditor | null) => void;
};

const WorkspaceEditorsContext = createContext<WorkspaceEditors | null>(null);

export function WorkspaceEditorsProvider({ children }: { children: ReactNode }) {
  const [canvasEditor, setCanvasEditor] = useState<Editor | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [docEditor, setDocEditor] = useState<DocEditor | null>(null);

  const value = useMemo(
    () => ({ canvasEditor, canvasVisible, docEditor, setCanvasEditor, setCanvasVisible, setDocEditor }),
    [canvasEditor, canvasVisible, docEditor]
  );

  return <WorkspaceEditorsContext.Provider value={value}>{children}</WorkspaceEditorsContext.Provider>;
}

export function useWorkspaceEditors() {
  const context = useContext(WorkspaceEditorsContext);
  if (!context) throw new Error("useWorkspaceEditors must be used inside <WorkspaceEditorsProvider>");
  return context;
}
