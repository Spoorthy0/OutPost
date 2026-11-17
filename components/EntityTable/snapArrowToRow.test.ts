import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShapeId, type Editor, type TLArrowBinding, type TLShapeId } from "tldraw";
import { createTestEditor } from "@/tests/editor";
import { registerArrowRowSnapping } from "./snapArrowToRow";
import { createEntityTable, rowCenterY, type EntityTableShape } from "./EntityTableShapeUtil";

let editor: Editor;
let stop: () => void;
let posts: TLShapeId;

const table = (id: TLShapeId) => editor.getShape<EntityTableShape>(id)!;
const endBinding = (arrowId: TLShapeId) =>
  editor.getBindingsFromShape<TLArrowBinding>(arrowId, "arrow").find((b) => b.props.terminal === "end")!;

// A user-drawn arrow whose end lands at (x, y), each 0-1 of the target's size.
function drawArrowTo(tableId: TLShapeId, y: number, x = 0.1) {
  const arrowId = createShapeId();
  editor.createShape({ id: arrowId, type: "arrow", x: -200, y: 0 });
  editor.createBinding<TLArrowBinding>({
    type: "arrow",
    fromId: arrowId,
    toId: tableId,
    props: { terminal: "end", normalizedAnchor: { x, y }, isExact: false, isPrecise: true, snap: "none" },
  });
  return arrowId;
}

beforeEach(() => {
  editor = createTestEditor();
  stop = registerArrowRowSnapping(editor);
  const fields = ["id", "title", "body", "author_id"].map((name) => ({ name, type: "text", pk: name === "id", fk: false }));
  posts = createEntityTable(editor, { x: 0, y: 0, name: "posts", fields });
});
afterEach(() => {
  stop();
  editor.dispose();
});

describe("registerArrowRowSnapping", () => {
  it("snaps a new arrow end to the middle of the row it lands on, on the near side", () => {
    const { h, fields } = table(posts).props;
    // Somewhere inside the third row (body), towards the top of it.
    const y = (rowCenterY(2) - 10) / h;
    const arrowId = drawArrowTo(posts, y);

    const binding = endBinding(arrowId);
    expect(binding.meta.fieldId).toBe(fields[2].id);
    expect(binding.props.normalizedAnchor.y).toBeCloseTo(rowCenterY(2) / h);
    expect(binding.props.normalizedAnchor.x).toBe(0);
  });

  it("uses the right edge when the arrow lands on the right half", () => {
    const arrowId = drawArrowTo(posts, 0.5, 0.9);
    expect(endBinding(arrowId).props.normalizedAnchor.x).toBe(1);
  });

  it("treats the header as the first row", () => {
    const arrowId = drawArrowTo(posts, 0.01);
    expect(endBinding(arrowId).meta.fieldId).toBe(table(posts).props.fields[0].id);
  });

  it("keeps the arrow on its column when columns are reordered", () => {
    const { fields } = table(posts).props;
    const arrowId = drawArrowTo(posts, rowCenterY(3) / table(posts).props.h); // author_id
    expect(endBinding(arrowId).meta.fieldId).toBe(fields[3].id);

    // Move author_id to the top.
    const reordered = [fields[3], fields[0], fields[1], fields[2]];
    editor.updateShape<EntityTableShape>({ id: posts, type: "entity-table", props: { fields: reordered } });

    const binding = endBinding(arrowId);
    expect(binding.meta.fieldId).toBe(fields[3].id);
    expect(binding.props.normalizedAnchor.y).toBeCloseTo(rowCenterY(0) / table(posts).props.h);
  });

  it("falls back to the row now in its place when its column is deleted", () => {
    const { fields } = table(posts).props;
    const arrowId = drawArrowTo(posts, rowCenterY(3) / table(posts).props.h); // author_id, the last row

    editor.updateShape<EntityTableShape>({ id: posts, type: "entity-table", props: { fields: fields.slice(0, 3) } });
    expect(endBinding(arrowId).meta.fieldId).toBe(fields[2].id);
  });

  it("leaves arrows to other shapes alone", () => {
    const boxId = createShapeId();
    editor.createShape({ id: boxId, type: "geo", x: 0, y: 400, props: { w: 100, h: 100 } });
    const arrowId = drawArrowTo(boxId, 0.37, 0.42);
    expect(endBinding(arrowId).props.normalizedAnchor).toEqual({ x: 0.42, y: 0.37 });
    expect(endBinding(arrowId).meta.fieldId).toBeUndefined();
  });
});
