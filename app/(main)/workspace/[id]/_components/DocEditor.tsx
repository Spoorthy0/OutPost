"use client";

import { useEffect, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { saveDocContent } from "@/actions/doc";
import type { Prisma } from "@/lib/generated/prisma/client";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";

const SAVE_DEBOUNCE_MS = 1000;

export function DocEditor({
  workspaceId,
  initialContent,
  onContentChange,
}: {
  workspaceId: string;
  initialContent: PartialBlock[] | null;
  // Lets the parent keep the latest blocks, so switching views and back doesn't lose edits.
  onContentChange?: (blocks: PartialBlock[]) => void;
}) {
  const { setDocEditor } = useWorkspaceEditors();
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<(() => void) | null>(null);

  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
  });

  useEffect(() => {
    setDocEditor(editor);
    return () => {
      setDocEditor(null);
      // Flush an edit that was still waiting on the debounce.
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      pendingSave.current?.();
    };
  }, [editor, setDocEditor]);

  const handleChange = () => {
    const blocks = editor.document;
    onContentChange?.(blocks);

    pendingSave.current = () => {
      pendingSave.current = null;
      saveDocContent(workspaceId, JSON.parse(JSON.stringify(blocks)) as Prisma.InputJsonValue);
    };
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => pendingSave.current?.(), SAVE_DEBOUNCE_MS);
  };

  return (
    <div className="outpost-doc h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-2 pt-14 pb-40 sm:px-6">
        <BlockNoteView editor={editor} theme="dark" onChange={handleChange} />
      </div>
    </div>
  );
}
