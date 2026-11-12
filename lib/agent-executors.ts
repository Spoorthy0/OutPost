"use client";

import {
  createShapeId,
  toRichText,
  type Editor,
  type TLArrowBinding,
  type TLArrowShape,
  type TLGeoShape,
  type TLShape,
  type TLShapeId,
  type TLShapePartial,
} from "tldraw";
import type { z } from "zod";
import type { DocEditor } from "@/components/WorkspaceEditorsContext";
import {
  ENTITY_TABLE_TYPE,
  DEFAULT_W,
  createEntityTable,
  heightFor,
  newFieldId,
  type EntityField,
  type EntityTableShape,
} from "@/components/EntityTable/EntityTableShapeUtil";
import { connectTableRows } from "@/components/EntityTable/snapArrowToRow";
import {
  clearCanvasInput,
  createDiagramInput,
  createTablesInput,
  editDocInput,
  editShapesInput,
  updateTableInput,
  writeDocInput,
  type AgentContext,
} from "@/lib/agent-tools";

// Runs the agent's tool calls against the live editors, in the browser. Each returns a short
// result the model reads back, including when a surface isn't open in the current view.

type Editors = { canvasEditor: Editor | null; docEditor: DocEditor | null };
type ToolResult = { ok: true; summary: string } | { ok: false; error: string };

const MAX_SUMMARY_SHAPES = 150;
const MAX_DOC_CHARS = 12_000;
const GAP = 140;

// ─── Context sent with each request ──────────────────────────────────────────────────────────────

function describeCanvas(editor: Editor) {
  const shapes = editor.getCurrentPageShapesSorted();
  if (shapes.length === 0) return "(empty)";

  const nameOf = (id: TLShapeId) => {
    const shape = editor.getShape(id);
    if (!shape) return "?";
    if (shape.type === ENTITY_TABLE_TYPE) return (shape as EntityTableShape).props.name;
    return editor.getShapeUtil(shape).getText(shape)?.trim() || shape.type;
  };

  // Each line starts with the shape id, so edit_shapes can target it.
  const lines = shapes.slice(0, MAX_SUMMARY_SHAPES).map((shape) => `- [${shape.id}] ${describeShape(shape)}`);

  if (shapes.length > MAX_SUMMARY_SHAPES) lines.push(`- …and ${shapes.length - MAX_SUMMARY_SHAPES} more`);
  return lines.join("\n");

  function describeShape(shape: TLShape) {
    if (shape.type === ENTITY_TABLE_TYPE) {
      const { name, fields } = (shape as EntityTableShape).props;
      const columns = fields.map((f) => `${f.name} ${f.type}${f.pk ? " PK" : ""}${f.fk ? " FK" : ""}`);
      return `table ${name} (${columns.join(", ")})`;
    }
    if (shape.type === "arrow") {
      const bindings = editor.getBindingsFromShape<TLArrowBinding>(shape, "arrow");
      const start = bindings.find((b) => b.props.terminal === "start");
      const end = bindings.find((b) => b.props.terminal === "end");
      const label = editor.getShapeUtil(shape).getText(shape)?.trim();
      return `arrow ${start ? nameOf(start.toId) : "·"} → ${end ? nameOf(end.toId) : "·"}${label ? ` "${label}"` : ""}`;
    }
    const text = editor.getShapeUtil(shape).getText(shape)?.trim();
    const kind = shape.type === "geo" ? (shape as TLGeoShape).props.geo : shape.type;
    return `${kind}${text ? ` "${text}"` : ""}`;
  }
}

// One entry per top-level block, prefixed with its id so edit_doc can target it.
function describeDoc(editor: DocEditor) {
  if (isBlank(editor)) return "";
  let doc = editor.document
    .map((block) => {
      const markdown = editor.blocksToMarkdownLossy([block]).trim();
      return `[${block.id}] ${markdown.replace(/\n/g, "\n    ")}`;
    })
    .join("\n");
  if (doc.length > MAX_DOC_CHARS) doc = `${doc.slice(0, MAX_DOC_CHARS)}\n…(truncated)`;
  return doc;
}

export function buildAgentContext({ canvasEditor, docEditor }: Editors): AgentContext {
  const doc = docEditor ? describeDoc(docEditor) : "";
  return {
    canvasOpen: !!canvasEditor,
    docOpen: !!docEditor,
    canvas: canvasEditor ? describeCanvas(canvasEditor) : "",
    doc: doc || (docEditor ? "(empty)" : ""),
  };
}

// ─── Canvas ──────────────────────────────────────────────────────────────────────────────────────

// New content goes to the right of whatever is already there, so nothing lands on top of it.
function originFor(editor: Editor) {
  const bounds = editor.getCurrentPageBounds();
  if (!bounds) {
    const center = editor.getViewportPageBounds().center;
    return { x: center.x - 400, y: center.y - 250 };
  }
  return { x: bounds.maxX + GAP * 1.5, y: bounds.minY };
}

function finishCanvas(editor: Editor, ids: TLShapeId[]) {
  editor.select(...ids);
  editor.zoomToSelection({ animation: { duration: 450 } });
  editor.selectNone();
}

function createArrow(editor: Editor, label?: string) {
  const id = createShapeId();
  editor.createShape<TLArrowShape>({
    id,
    type: "arrow",
    props: { richText: toRichText(label ?? ""), color: "grey" },
  });
  return id;
}

function bindArrowCenter(editor: Editor, arrowId: TLShapeId, terminal: "start" | "end", toId: TLShapeId) {
  editor.createBinding<TLArrowBinding>({
    type: "arrow",
    fromId: arrowId,
    toId,
    props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: "none" },
  });
}

function createTables(editor: Editor, input: z.infer<typeof createTablesInput>): ToolResult {
  const origin = originFor(editor);
  const columns = Math.ceil(Math.sqrt(input.tables.length));
  const ids = new Map<string, TLShapeId>();
  const created: TLShapeId[] = [];

  // Grid layout: each grid row is as tall as its tallest table.
  let y = origin.y;
  for (let start = 0; start < input.tables.length; start += columns) {
    const row = input.tables.slice(start, start + columns);
    let rowHeight = 0;
    row.forEach((table, column) => {
      const fields = table.fields.map((f) => ({ name: f.name, type: f.type, pk: !!f.pk, fk: !!f.fk }));
      const id = createEntityTable(editor, {
        x: origin.x + column * (DEFAULT_W + GAP * 1.4),
        y,
        name: table.name,
        fields,
      });
      ids.set(table.name.toLowerCase(), id);
      created.push(id);
      rowHeight = Math.max(rowHeight, heightFor(fields.map((f, i) => ({ ...f, id: String(i) }))));
    });
    y += rowHeight + GAP;
  }

  // Relations can also point at tables that were already on the canvas.
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== ENTITY_TABLE_TYPE) continue;
    const name = (shape as EntityTableShape).props.name.toLowerCase();
    if (!ids.has(name)) ids.set(name, shape.id);
  }

  const skipped: string[] = [];
  for (const relation of input.relations) {
    const fromId = ids.get(relation.fromTable.toLowerCase());
    const toId = ids.get(relation.toTable.toLowerCase());
    const fromTable = fromId && (editor.getShape(fromId) as EntityTableShape | undefined);
    const toTable = toId && (editor.getShape(toId) as EntityTableShape | undefined);
    if (!fromTable || !toTable) {
      skipped.push(`${relation.fromTable} → ${relation.toTable}`);
      continue;
    }
    const rowOf = (table: EntityTableShape, column: string) =>
      Math.max(0, table.props.fields.findIndex((f) => f.name.toLowerCase() === column.toLowerCase()));

    const arrowId = createArrow(editor, relation.label);
    connectTableRows(
      editor,
      arrowId,
      { tableId: fromTable.id, rowIndex: rowOf(fromTable, relation.fromColumn) },
      { tableId: toTable.id, rowIndex: rowOf(toTable, relation.toColumn) }
    );
    created.push(arrowId);
  }

  finishCanvas(editor, created);
  return {
    ok: true,
    summary:
      `Drew ${input.tables.length} table(s) and ${input.relations.length - skipped.length} relation(s).` +
      (skipped.length ? ` Skipped relations to unknown tables: ${skipped.join(", ")}.` : ""),
  };
}

const NODE_SIZE: Record<string, { w: number; h: number }> = {
  rectangle: { w: 220, h: 96 },
  ellipse: { w: 200, h: 110 },
  diamond: { w: 200, h: 140 },
  cloud: { w: 230, h: 130 },
  hexagon: { w: 210, h: 110 },
};

function createDiagram(editor: Editor, input: z.infer<typeof createDiagramInput>): ToolResult {
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  const edges = input.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to) && e.from !== e.to);

  // Layered layout: each node sits one level past its deepest parent (cycles are cut by a cap).
  const level = new Map(input.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < input.nodes.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      const next = level.get(edge.from)! + 1;
      if (next > level.get(edge.to)! && next < input.nodes.length) {
        level.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const layers: (typeof input.nodes)[] = [];
  for (const node of input.nodes) (layers[level.get(node.id)!] ??= []).push(node);

  const origin = originFor(editor);
  const horizontal = input.direction === "horizontal";
  const step = { main: 300, cross: 170 };
  const widest = Math.max(...layers.filter(Boolean).map((layer) => layer.length));
  const shapeIds = new Map<string, TLShapeId>();
  const created: TLShapeId[] = [];

  layers.forEach((layer, depth) => {
    if (!layer) return;
    // Center each layer on the widest one.
    const offset = ((widest - layer.length) * step.cross) / 2;
    layer.forEach((node, index) => {
      const size = NODE_SIZE[node.shape] ?? NODE_SIZE.rectangle;
      const main = depth * step.main;
      const cross = offset + index * step.cross * (horizontal ? 1 : 1.6);
      const id = createShapeId();
      editor.createShape<TLGeoShape>({
        id,
        type: "geo",
        x: origin.x + (horizontal ? main : cross),
        y: origin.y + (horizontal ? cross : main * 0.7),
        props: {
          geo: node.shape,
          w: size.w,
          h: size.h,
          richText: toRichText(node.label),
          color: node.color ?? "light-blue",
          fill: "semi",
          size: "s",
          font: "sans",
        },
      });
      shapeIds.set(node.id, id);
      created.push(id);
    });
  });

  for (const edge of edges) {
    const arrowId = createArrow(editor, edge.label);
    bindArrowCenter(editor, arrowId, "start", shapeIds.get(edge.from)!);
    bindArrowCenter(editor, arrowId, "end", shapeIds.get(edge.to)!);
    created.push(arrowId);
  }

  finishCanvas(editor, created);
  return { ok: true, summary: `Drew ${input.nodes.length} node(s) and ${edges.length} connection(s).` };
}

function findTable(editor: Editor, name: string) {
  const wanted = name.toLowerCase();
  return editor
    .getCurrentPageShapes()
    .find(
      (shape): shape is EntityTableShape =>
        shape.type === ENTITY_TABLE_TYPE && (shape as EntityTableShape).props.name.toLowerCase() === wanted
    );
}

function updateTable(editor: Editor, input: z.infer<typeof updateTableInput>): ToolResult {
  const table = findTable(editor, input.table);
  if (!table) return { ok: false, error: `No table named "${input.table}" on the canvas.` };

  const sameName = (field: EntityField, name: string) => field.name.toLowerCase() === name.toLowerCase();
  const missing = [...input.updateColumns.map((c) => c.column), ...input.removeColumns].filter(
    (name) => !table.props.fields.some((field) => sameName(field, name))
  );
  if (missing.length) return { ok: false, error: `No column(s) ${missing.join(", ")} in ${table.props.name}.` };

  // Fields keep their ids, so relationship arrows follow their columns (see snapArrowToRow).
  let fields = table.props.fields
    .filter((field) => !input.removeColumns.some((name) => sameName(field, name)))
    .map((field) => {
      const change = input.updateColumns.find((c) => sameName(field, c.column));
      if (!change) return field;
      const props = { name: change.name, type: change.type, pk: change.pk, fk: change.fk };
      return { ...field, ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) };
    });
  fields = [
    ...fields,
    ...input.addColumns.map((c) => ({ id: newFieldId(), name: c.name, type: c.type, pk: !!c.pk, fk: !!c.fk })),
  ];

  editor.updateShape<EntityTableShape>({
    id: table.id,
    type: ENTITY_TABLE_TYPE,
    props: { name: input.rename ?? table.props.name, fields, h: heightFor(fields) },
  });
  return { ok: true, summary: `Updated table ${input.rename ?? table.props.name}.` };
}

function editShapes(editor: Editor, input: z.infer<typeof editShapesInput>): ToolResult {
  const unknown: string[] = [];
  let relabeled = 0;
  for (const { shapeId, text } of input.relabel) {
    const shape = editor.getShape(shapeId as TLShapeId);
    if (!shape || !("richText" in shape.props)) {
      unknown.push(shapeId);
      continue;
    }
    // The shape's type is only known at runtime, hence tldraw's loose partial type.
    editor.updateShape({ id: shape.id, type: shape.type, props: { richText: toRichText(text) } } as TLShapePartial);
    relabeled++;
  }

  const toDelete = input.delete.filter((id) => {
    const exists = !!editor.getShape(id as TLShapeId);
    if (!exists) unknown.push(id);
    return exists;
  }) as TLShapeId[];
  editor.deleteShapes(toDelete);

  return {
    ok: true,
    summary:
      `Relabeled ${relabeled} and deleted ${toDelete.length} shape(s).` +
      (unknown.length ? ` Unknown or unlabeled shape ids skipped: ${unknown.join(", ")}.` : ""),
  };
}

function clearCanvas(editor: Editor): ToolResult {
  const ids = [...editor.getCurrentPageShapeIds()];
  editor.deleteShapes(ids);
  return { ok: true, summary: `Cleared ${ids.length} shape(s) from the canvas.` };
}

// ─── Doc ─────────────────────────────────────────────────────────────────────────────────────────

function isBlank(editor: DocEditor) {
  const blocks = editor.document;
  return (
    blocks.length === 0 ||
    (blocks.length === 1 && Array.isArray(blocks[0].content) && blocks[0].content.length === 0)
  );
}

// Models sometimes send escaped newlines ("\\n") instead of real ones; markdown needs real ones.
function normalizeMarkdown(markdown: string) {
  return markdown.includes("\n") ? markdown : markdown.replace(/\\n/g, "\n");
}

function parseMarkdown(editor: DocEditor, markdown: string) {
  return editor.tryParseMarkdownToBlocks(normalizeMarkdown(markdown));
}

function editDoc(editor: DocEditor, input: z.infer<typeof editDocInput>): ToolResult {
  let applied = 0;
  const problems: string[] = [];

  for (const op of input.operations) {
    if (!editor.getBlock(op.blockId)) {
      problems.push(`unknown block ${op.blockId}`);
      continue;
    }
    if (op.action === "delete") {
      // A doc can't be empty, so deleting its only block leaves an empty paragraph.
      if (editor.document.length === 1) editor.replaceBlocks([op.blockId], [{ type: "paragraph" }]);
      else editor.removeBlocks([op.blockId]);
      applied++;
      continue;
    }
    const blocks = op.markdown ? parseMarkdown(editor, op.markdown) : [];
    if (blocks.length === 0) {
      problems.push(`${op.action} on ${op.blockId} had no markdown`);
      continue;
    }
    if (op.action === "replace") editor.replaceBlocks([op.blockId], blocks);
    else editor.insertBlocks(blocks, op.blockId, "after");
    applied++;
  }

  if (applied === 0) return { ok: false, error: `Nothing changed: ${problems.join("; ")}.` };
  return {
    ok: true,
    summary: `Applied ${applied} doc edit(s).` + (problems.length ? ` Skipped: ${problems.join("; ")}.` : ""),
  };
}

function writeDoc(editor: DocEditor, input: z.infer<typeof writeDocInput>): ToolResult {
  const blocks = parseMarkdown(editor, input.markdown);
  if (blocks.length === 0) return { ok: false, error: "The markdown was empty." };

  if (input.mode === "replace" || isBlank(editor)) {
    editor.replaceBlocks(editor.document, blocks);
  } else {
    const last = editor.document[editor.document.length - 1];
    editor.insertBlocks(blocks, last, "after");
  }
  return { ok: true, summary: `Wrote ${blocks.length} block(s) to the doc (${input.mode}).` };
}

// ─── Dispatch ────────────────────────────────────────────────────────────────────────────────────

const NOT_OPEN = {
  canvas: "The canvas isn't open in the current view. Ask the user to switch to the Canvas or Both view.",
  doc: "The doc isn't open in the current view. Ask the user to switch to the Doc or Both view.",
};

export function runAgentTool(toolName: string, rawInput: unknown, { canvasEditor, docEditor }: Editors): ToolResult {
  try {
    switch (toolName) {
      case "create_tables": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        const input = createTablesInput.parse(rawInput);
        canvasEditor.markHistoryStoppingPoint("agent: create tables");
        return createTables(canvasEditor, input);
      }
      case "create_diagram": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        const input = createDiagramInput.parse(rawInput);
        canvasEditor.markHistoryStoppingPoint("agent: create diagram");
        return createDiagram(canvasEditor, input);
      }
      case "clear_canvas": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        clearCanvasInput.parse(rawInput ?? {});
        canvasEditor.markHistoryStoppingPoint("agent: clear canvas");
        return clearCanvas(canvasEditor);
      }
      case "update_table": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        const input = updateTableInput.parse(rawInput);
        canvasEditor.markHistoryStoppingPoint("agent: update table");
        return updateTable(canvasEditor, input);
      }
      case "edit_shapes": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        const input = editShapesInput.parse(rawInput);
        canvasEditor.markHistoryStoppingPoint("agent: edit shapes");
        return editShapes(canvasEditor, input);
      }
      case "write_doc": {
        if (!docEditor) return { ok: false, error: NOT_OPEN.doc };
        return writeDoc(docEditor, writeDocInput.parse(rawInput));
      }
      case "edit_doc": {
        if (!docEditor) return { ok: false, error: NOT_OPEN.doc };
        return editDoc(docEditor, editDocInput.parse(rawInput));
      }
      default:
        return { ok: false, error: `Unknown tool ${toolName}` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The tool failed." };
  }
}
