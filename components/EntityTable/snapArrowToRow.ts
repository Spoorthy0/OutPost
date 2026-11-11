import type { Editor, TLArrowBinding, TLBinding, TLShapeId, VecLike } from "tldraw";
import {
  ENTITY_TABLE_TYPE,
  HEADER_H,
  ROW_H,
  rowCenterY,
  type EntityField,
  type EntityTableShape,
} from "./EntityTableShapeUtil";

// An arrow bound to an ERD table points at one of its columns. The column is remembered by field id
// in the binding's meta, so the arrow stays on that column when rows are added, removed or reordered
// (the anchor itself is only a fraction of the table's height, which changes with every column).
type RowBindingMeta = { fieldId?: string };

type Side = "left" | "right";

function getTable(editor: Editor, id: TLShapeId) {
  const shape = editor.getShape(id);
  return shape?.type === ENTITY_TABLE_TYPE ? (shape as EntityTableShape) : null;
}

function isArrowBinding(binding: TLBinding): binding is TLArrowBinding {
  return binding.type === "arrow";
}

function clampIndex(fields: EntityField[], index: number) {
  return Math.min(Math.max(index, 0), Math.max(fields.length - 1, 0));
}

// Nearest row to a y in table space (the header counts as the first row).
function rowIndexAt(fields: EntityField[], y: number) {
  return clampIndex(fields, Math.floor((y - HEADER_H) / ROW_H));
}

function rowAnchor(table: EntityTableShape, rowIndex: number, side: Side) {
  return {
    x: side === "left" ? 0 : 1,
    y: rowCenterY(clampIndex(table.props.fields, rowIndex)) / table.props.h,
  };
}

function snappedProps(binding: TLArrowBinding, table: EntityTableShape, rowIndex: number, side: Side) {
  return {
    ...binding.props,
    normalizedAnchor: rowAnchor(table, rowIndex, side),
    isPrecise: true,
    isExact: false,
    snap: "none" as const,
  };
}

function withField(binding: TLArrowBinding, fieldId: string | undefined): TLArrowBinding["meta"] {
  return { ...binding.meta, fieldId: fieldId ?? null };
}

// Where the user is pointing this arrow end, in table space. While an end is dragged quickly onto a
// shape, tldraw anchors it to the shape's center instead of the pointer, which would always pick the
// middle row, so then the pointer itself is used.
function targetPoint(editor: Editor, binding: TLArrowBinding, table: EntityTableShape): VecLike {
  const { normalizedAnchor, isPrecise } = binding.props;
  if (!isPrecise) {
    const pointer = editor.getPointInShapeSpace(table, editor.inputs.getCurrentPagePoint());
    const margin = 16;
    const inside =
      pointer.x >= -margin &&
      pointer.x <= table.props.w + margin &&
      pointer.y >= -margin &&
      pointer.y <= table.props.h + margin;
    if (inside) return pointer;
  }
  return { x: normalizedAnchor.x * table.props.w, y: normalizedAnchor.y * table.props.h };
}

// Rewrites an arrow binding to an ERD table so it lands on a row, on the side it came in from.
function snapBinding(editor: Editor, next: TLArrowBinding, prev?: TLArrowBinding): TLArrowBinding {
  const table = getTable(editor, next.toId);
  if (!table || table.props.fields.length === 0) return next;

  const { fields } = table.props;
  const fieldId = (next.meta as RowBindingMeta).fieldId;
  const knownIndex = fieldId ? fields.findIndex((field) => field.id === fieldId) : -1;

  const moved =
    !prev ||
    prev.toId !== next.toId ||
    prev.props.normalizedAnchor.x !== next.props.normalizedAnchor.x ||
    prev.props.normalizedAnchor.y !== next.props.normalizedAnchor.y ||
    prev.props.isPrecise !== next.props.isPrecise;

  // Unchanged end that already knows its column (e.g. only its arrowhead changed): keep the column.
  if (!moved && knownIndex >= 0) {
    const side = next.props.normalizedAnchor.x < 0.5 ? "left" : "right";
    return { ...next, props: snappedProps(next, table, knownIndex, side) };
  }

  const point = targetPoint(editor, next, table);
  const index = rowIndexAt(fields, point.y);
  const side = point.x < table.props.w / 2 ? "left" : "right";
  return { ...next, meta: withField(next, fields[index]?.id), props: snappedProps(next, table, index, side) };
}

// After a table's columns change, puts every arrow bound to it back on its column's row.
function followColumns(editor: Editor, prev: EntityTableShape, next: EntityTableShape) {
  if (prev.props.fields === next.props.fields && prev.props.h === next.props.h) return;

  const nextFields = next.props.fields;
  if (nextFields.length === 0) return;

  for (const binding of editor.getBindingsToShape(next.id, "arrow")) {
    if (!isArrowBinding(binding)) continue;
    const { normalizedAnchor } = binding.props;

    // Which column it pointed at: its stored field, else the row it sat on before the change
    // (arrows drawn before field ids were stored).
    let fieldId = (binding.meta as RowBindingMeta).fieldId;
    if (!fieldId || !prev.props.fields.some((field) => field.id === fieldId)) {
      fieldId = prev.props.fields[rowIndexAt(prev.props.fields, normalizedAnchor.y * prev.props.h)]?.id;
    }

    // A deleted column falls back to whatever row now sits where it was.
    let index = nextFields.findIndex((field) => field.id === fieldId);
    if (index < 0) {
      index = clampIndex(nextFields, prev.props.fields.findIndex((field) => field.id === fieldId));
      fieldId = nextFields[index]?.id;
    }

    const props = snappedProps(binding, next, index, normalizedAnchor.x < 0.5 ? "left" : "right");
    if (props.normalizedAnchor.y === normalizedAnchor.y && binding.meta.fieldId === fieldId) continue;
    editor.updateBinding<TLArrowBinding>({ ...binding, meta: withField(binding, fieldId), props });
  }
}

// Installs row snapping on the editor. Only local edits are rewritten: remote ones were already
// snapped by the collaborator who made them. Returns a function that removes the handlers.
export function registerArrowRowSnapping(editor: Editor) {
  const removers = [
    editor.sideEffects.registerBeforeCreateHandler("binding", (binding, source) =>
      source === "user" && isArrowBinding(binding) ? snapBinding(editor, binding) : binding
    ),
    editor.sideEffects.registerBeforeChangeHandler("binding", (prev, next, source) =>
      source === "user" && isArrowBinding(next) && isArrowBinding(prev) ? snapBinding(editor, next, prev) : next
    ),
    editor.sideEffects.registerAfterChangeHandler("shape", (prev, next, source) => {
      if (source !== "user" || next.type !== ENTITY_TABLE_TYPE || prev.type !== ENTITY_TABLE_TYPE) return;
      followColumns(editor, prev as EntityTableShape, next as EntityTableShape);
    }),
  ];
  return () => removers.forEach((remove) => remove());
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
    const fields = end.table.props.fields;
    editor.createBinding<TLArrowBinding>({
      type: "arrow",
      fromId: arrowId,
      toId: end.table.id,
      meta: { fieldId: fields[clampIndex(fields, end.rowIndex)]?.id ?? null },
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
