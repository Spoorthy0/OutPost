"use client";

import { TldrawUiToolbarButton, useEditor } from "tldraw";
import { Table2 } from "lucide-react";
import { DEFAULT_W, createEntityTable } from "./EntityTableShapeUtil";

// Toolbar button: drops a starter ERD table in the middle of the view and opens it for editing.
export function AddEntityTableButton() {
  const editor = useEditor();

  const addTable = () => {
    const center = editor.getViewportPageBounds().center;
    editor.markHistoryStoppingPoint("add entity table");
    const id = createEntityTable(editor, {
      x: center.x - DEFAULT_W / 2,
      y: center.y - 80,
      name: "new_table",
      fields: [
        { name: "id", type: "uuid", pk: true, fk: false },
        { name: "created_at", type: "timestamp", pk: false, fk: false },
      ],
    });
    editor.setCurrentTool("select");
    editor.select(id);
    editor.setEditingShape(id);
  };

  return (
    <TldrawUiToolbarButton type="tool" tooltip="Add table" aria-label="Add table" onClick={addTable}>
      <Table2 className="size-4.5" strokeWidth={1.75} />
    </TldrawUiToolbarButton>
  );
}
