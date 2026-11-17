import type { Editor, TLArrowBinding } from "tldraw";
import {
  ENTITY_TABLE_TYPE,
  HEADER_H,
  ROW_H,
  type EntityField,
  type EntityTableShape,
} from "@/components/EntityTable/EntityTableShapeUtil";
import type { ErdRelation, ErdSchema } from "@/lib/erd-export";

// Which column an arrow end points at: the field id it remembers (see snapArrowToRow), or else the
// row under its anchor.
function columnAt(table: EntityTableShape, binding: TLArrowBinding): EntityField | undefined {
  const { fields, h } = table.props;
  const fieldId = (binding.meta as { fieldId?: string | null }).fieldId;
  const byId = fieldId ? fields.find((f) => f.id === fieldId) : undefined;
  if (byId) return byId;
  const index = Math.floor((binding.props.normalizedAnchor.y * h - HEADER_H) / ROW_H);
  return fields[Math.min(Math.max(index, 0), fields.length - 1)];
}

// The ERD on the current page: every table, and every arrow that joins two table columns.
export function readErdSchema(editor: Editor): ErdSchema {
  const shapes = editor.getCurrentPageShapesSorted();
  const tables = shapes.filter((s): s is EntityTableShape => s.type === ENTITY_TABLE_TYPE);
  const tableById = new Map(tables.map((t) => [t.id, t]));

  const relations: ErdRelation[] = [];
  const seen = new Set<string>();
  for (const shape of shapes) {
    if (shape.type !== "arrow") continue;
    const bindings = editor.getBindingsFromShape<TLArrowBinding>(shape, "arrow");
    const start = bindings.find((b) => b.props.terminal === "start");
    const end = bindings.find((b) => b.props.terminal === "end");
    const startTable = start && tableById.get(start.toId as EntityTableShape["id"]);
    const endTable = end && tableById.get(end.toId as EntityTableShape["id"]);
    if (!start || !end || !startTable || !endTable) continue;

    const startColumn = columnAt(startTable, start);
    const endColumn = columnAt(endTable, end);
    if (!startColumn || !endColumn) continue;

    // Arrows are drawn from the foreign key to what it references, but people draw them either
    // way: when only the start is a primary key and the end is a foreign key, flip it.
    const flipped = startColumn.pk && !startColumn.fk && endColumn.fk && !endColumn.pk;
    const relation = flipped
      ? { fromTable: endTable.props.name, fromColumn: endColumn.name, toTable: startTable.props.name, toColumn: startColumn.name }
      : { fromTable: startTable.props.name, fromColumn: startColumn.name, toTable: endTable.props.name, toColumn: endColumn.name };

    const key = `${relation.fromTable}.${relation.fromColumn}->${relation.toTable}.${relation.toColumn}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push(relation);
  }

  return {
    tables: tables.map((t) => ({
      name: t.props.name,
      columns: t.props.fields.map(({ name, type, pk, fk }) => ({ name, type, pk, fk })),
    })),
    relations,
  };
}
