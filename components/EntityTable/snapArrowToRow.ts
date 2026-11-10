import type { Editor, TLArrowBinding, TLShapeId } from "tldraw";
import { ENTITY_TABLE_TYPE, HEADER_H, ROW_H, rowCenterY, type EntityTableShape } from "./EntityTableShapeUtil";

function getTable(editor: Editor, id: TLShapeId) {
  const shape = editor.getShape(id);
  return shape?.type === ENTITY_TABLE_TYPE ? (shape as EntityTableShape) : null;
}

function rowAnchor(table: EntityTableShape, rowIndex: number, side: "left" | "right") {
  const index = Math.min(Math.max(rowIndex, 0), Math.max(table.props.fields.length - 1, 0));
  return { x: side === "left" ? 0 : 1, y: rowCenterY(index) / table.props.h };
}

// An arrow dropped anywhere on an ERD table snaps to the nearest column row, on whichever side
// it came in from, so relationships read as "posts.author_id → users.id" rather than box-to-box.
export function snapArrowBindingToRow(editor: Editor, binding: TLArrowBinding) {
  const table = getTable(editor, binding.toId);
  if (!table || table.props.fields.length === 0) return;

  const { normalizedAnchor } = binding.props;
  const y = normalizedAnchor.y * table.props.h;
  const index = Math.floor((y - HEADER_H) / ROW_H);
  const anchor = rowAnchor(table, index, normalizedAnchor.x < 0.5 ? "left" : "right");

  editor.updateBinding<TLArrowBinding>({
    id: binding.id,
    type: "arrow",
    props: { ...binding.props, normalizedAnchor: anchor, isPrecise: true, isExact: false },
  });
}

// Used by the agent: an arrow from one table row to another, e.g. a foreign key to its primary key.
export function connectTableRows(
  editor: Editor,
  arrowId: TLShapeId,
  from: { tableId: TLShapeId; rowIndex: number },
  to: { tableId: TLShapeId; rowIndex: number }
) {
  const fromTable = getTable(editor, from.tableId);
  const toTable = getTable(editor, to.tableId);
  if (!fromTable || !toTable) return false;

  // Leave from the side facing the other table.
  const fromIsLeft = fromTable.x + fromTable.props.w / 2 <= toTable.x + toTable.props.w / 2;
  const ends = [
    { terminal: "start" as const, table: fromTable, rowIndex: from.rowIndex, side: fromIsLeft ? "right" : "left" },
    { terminal: "end" as const, table: toTable, rowIndex: to.rowIndex, side: fromIsLeft ? "left" : "right" },
  ] as const;

  for (const end of ends) {
    editor.createBinding<TLArrowBinding>({
      type: "arrow",
      fromId: arrowId,
      toId: end.table.id,
      props: {
        terminal: end.terminal,
        normalizedAnchor: rowAnchor(end.table, end.rowIndex, end.side),
        isExact: false,
        isPrecise: true,
        snap: "none",
      },
    });
  }
  return true;
}
