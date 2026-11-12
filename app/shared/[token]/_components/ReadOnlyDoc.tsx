"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { PartialBlock } from "@blocknote/core";
import { outpostDarkTheme } from "@/lib/blocknote-theme";

// The doc as last saved (Doc.content), with no collaboration or saving: a plain read-only view.
export function ReadOnlyDoc({ content }: { content: PartialBlock[] }) {
  const editor = useCreateBlockNote({ initialContent: content });

  return (
    <div className="h-full overflow-y-auto pt-6">
      <BlockNoteView editor={editor} editable={false} theme={outpostDarkTheme} />
    </div>
  );
}
