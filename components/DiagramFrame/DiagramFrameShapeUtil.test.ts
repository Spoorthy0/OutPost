import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShapeId, type Editor, type TLFrameShape, type TLShapeId } from "tldraw";
import { createTestEditor } from "@/tests/editor";
import { runAgentTool } from "@/lib/agent-executors";
import { ENTITY_TABLE_TYPE, type EntityTableShape } from "@/components/EntityTable/EntityTableShapeUtil";
import {
  DIAGRAM_FRAME_PAD,
  isDiagramFrame,
  registerDiagramFrameFitting,
} from "@/components/DiagramFrame/DiagramFrameShapeUtil";

let editor: Editor;
let stopFitting: () => void;

beforeEach(() => {
  editor = createTestEditor();
  stopFitting = registerDiagramFrameFitting(editor);
});
afterEach(() => {
  stopFitting();
  editor.dispose();
});

async function drawSchema() {
  await runAgentTool(
    "create_tables",
    {
      title: "Shop",
      tables: [
        { name: "users", fields: [{ name: "id", type: "uuid", pk: true }] },
        { name: "orders", fields: [{ name: "id", type: "uuid", pk: true }, { name: "user_id", type: "uuid", fk: true }] },
      ],
      relations: [{ fromTable: "orders", fromColumn: "user_id", toTable: "users", toColumn: "id" }],
    },
    () => ({ canvasEditor: editor, docEditor: null })
  );
  const frame = editor.getCurrentPageShapes().find((s): s is TLFrameShape => s.type === "frame")!;
  const tables = editor
    .getCurrentPageShapes()
    .filter((s): s is EntityTableShape => s.type === ENTITY_TABLE_TYPE);
  return { frame, tables };
}

const frameOf = (id: TLShapeId) => editor.getShape<TLFrameShape>(id)!;
const pageBounds = (id: TLShapeId) => editor.getShapePageBounds(id)!;

describe("diagram frames", () => {
  it("are tagged, never clip their content and can't be resized by hand", async () => {
    const { frame, tables } = await drawSchema();
    expect(frame.meta.diagram).toBe(true);
    expect(isDiagramFrame(frame)).toBe(true);
    expect(editor.getShapeMask(tables[0].id)).toBeUndefined();
    expect(editor.getShapeUtil(frame).canResize(frame)).toBe(false);
  });

  it("recognizes diagrams drawn before frames were tagged by their title", () => {
    const old = { type: "frame", meta: {}, props: { name: "Flowchart · Checkout" } } as unknown as TLFrameShape;
    const handmade = { type: "frame", meta: {}, props: { name: "Ideas" } } as unknown as TLFrameShape;
    expect(isDiagramFrame(old)).toBe(true);
    expect(isDiagramFrame(handmade)).toBe(false);
  });

  it("grows when a table moves past its edge, and shrinks back when it returns", async () => {
    const { frame, tables } = await drawSchema();
    const before = frameOf(frame.id).props;
    const table = tables.reduce((a, b) => (b.x > a.x ? b : a)); // the rightmost one

    editor.updateShape({ id: table.id, type: ENTITY_TABLE_TYPE, x: table.x + 600 });
    const grown = frameOf(frame.id);
    expect(grown.props.w).toBeGreaterThan(before.w + 400);
    expect(pageBounds(frame.id).maxX).toBeCloseTo(pageBounds(table.id).maxX + DIAGRAM_FRAME_PAD, 0);

    editor.updateShape({ id: table.id, type: ENTITY_TABLE_TYPE, x: editor.getShape(table.id)!.x - 600 });
    expect(frameOf(frame.id).props.w).toBeCloseTo(before.w, 0);
  });

  it("moves its origin when content goes above or left, keeping every shape where it is", async () => {
    const { frame, tables } = await drawSchema();
    const [moved, other] = tables;
    const otherBefore = pageBounds(other.id);

    editor.updateShape({ id: moved.id, type: ENTITY_TABLE_TYPE, x: moved.x - 300, y: moved.y - 200 });
    const movedBounds = pageBounds(moved.id);
    expect(pageBounds(frame.id).minX).toBeCloseTo(movedBounds.minX - DIAGRAM_FRAME_PAD, 0);
    expect(pageBounds(frame.id).minY).toBeCloseTo(movedBounds.minY - DIAGRAM_FRAME_PAD, 0);
    expect(pageBounds(other.id).minX).toBeCloseTo(otherBefore.minX, 5);
    expect(pageBounds(other.id).minY).toBeCloseTo(otherBefore.minY, 5);
  });

  it("shrinks when a table is taken out of the diagram", async () => {
    const { frame, tables } = await drawSchema();
    const before = frameOf(frame.id).props;
    editor.reparentShapes([tables[1].id], editor.getCurrentPageId());
    editor.updateShape({ id: tables[1].id, type: ENTITY_TABLE_TYPE, x: tables[1].x + 2000 });
    const after = frameOf(frame.id).props;
    expect(after.w * after.h).toBeLessThan(before.w * before.h);
  });

  it("undoes a move and its refit together", async () => {
    const { frame, tables } = await drawSchema();
    const before = frameOf(frame.id);
    editor.markHistoryStoppingPoint("move");
    editor.updateShape({ id: tables[0].id, type: ENTITY_TABLE_TYPE, x: tables[0].x + 600 });
    editor.undo();
    const after = frameOf(frame.id);
    expect(after.props.w).toBeCloseTo(before.props.w, 5);
    expect(after.x).toBeCloseTo(before.x, 5);
  });

  it("leaves frames people draw themselves alone", () => {
    const frameId = createShapeId();
    const boxId = createShapeId();
    editor.createShape({ id: frameId, type: "frame", x: 0, y: 0, props: { w: 300, h: 200, name: "Ideas" } });
    editor.createShape({ id: boxId, type: "geo", parentId: frameId, x: 20, y: 20, props: { w: 100, h: 100 } });
    editor.updateShape({ id: boxId, type: "geo", x: 400 });
    expect(frameOf(frameId).props.w).toBe(300);
    expect(editor.getShapeMask(boxId)).toBeDefined();
  });
});
