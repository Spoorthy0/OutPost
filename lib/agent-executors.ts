"use client";

import {
  createShapeId,
  toRichText,
  type Editor,
  type TLArrowBinding,
  type TLArrowShape,
  type TLFrameShape,
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
  TABLE_COLORS,
  createEntityTable,
  heightFor,
  newFieldId,
  type EntityField,
  type EntityTableShape,
} from "@/components/EntityTable/EntityTableShapeUtil";
import { connectTableRows } from "@/components/EntityTable/snapArrowToRow";
import { layeredLayout } from "@/lib/canvas-layout";
import {
  DIAGRAM_KINDS,
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
    if (shape.type === "frame") return `frame "${(shape as TLFrameShape).props.name}"`;
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

// Drawings appear step by step: the camera moves to where the frame will go, then each shape fades
// in, followed by the arrows that now have both ends. Long drawings speed up to fit MAX_DRAW_MS.
const NODE_STEP_MS = 260;
const EDGE_STEP_MS = 140;
const FADE_MS = 240;
const CAMERA_MS = 500;
const MAX_DRAW_MS = 7000;

// A drawing sits inside a frame titled with what it is; tldraw draws the title above the frame.
const FRAME_PAD = 72;
const FRAME_TITLE_SPACE = 48;
const FRAME_SEPARATION = 160;

const NODE_COLORS = {
  rectangle: "blue",
  ellipse: "green",
  diamond: "orange",
  hexagon: "violet",
  cloud: "light-blue",
} as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class CanvasClosedError extends Error {
  constructor() {
    super(
      "The canvas was closed while drawing, so the drawing is incomplete. Ask the user to reopen the Canvas or Both view."
    );
  }
}

function frameName(kind: string, title?: string) {
  const clean = title?.trim();
  return clean ? `${kind} · ${clean}` : kind;
}

// New content goes to the right of whatever is already there, so nothing lands on top of it.
function originFor(editor: Editor) {
  const bounds = editor.getCurrentPageBounds();
  if (!bounds) {
    const center = editor.getViewportPageBounds().center;
    return { x: center.x - 400, y: center.y - 250 };
  }
  return { x: bounds.maxX + FRAME_SEPARATION, y: bounds.minY };
}

// Runs the creation steps of one drawing, pausing between them so people can follow along.
function createPlayer(editor: Editor, counts: { nodes: number; edges: number }) {
  const instant = prefersReducedMotion();
  const planned = counts.nodes * NODE_STEP_MS + counts.edges * EDGE_STEP_MS;
  const scale = instant ? 0 : Math.min(1, MAX_DRAW_MS / Math.max(planned, 1));
  const created: TLShapeId[] = [];

  const assertOpen = () => {
    if (editor.isDisposed) throw new CanvasClosedError();
  };

  return {
    // Shapes start transparent and fade in; with reduced motion they appear at once.
    startOpacity: instant ? 1 : 0,

    // Creates a frame sized for the layout and brings it into view before anything is drawn in it.
    async openFrame(name: string, size: { width: number; height: number }) {
      assertOpen();
      const origin = originFor(editor);
      const w = size.width + FRAME_PAD * 2;
      const h = size.height + FRAME_PAD * 2;
      const view = { x: origin.x, y: origin.y - FRAME_TITLE_SPACE, w, h: h + FRAME_TITLE_SPACE };
      editor.zoomToBounds(view, { inset: 48, targetZoom: 1, ...(!instant && { animation: { duration: CAMERA_MS } }) });

      const id = createShapeId();
      editor.createShape<TLFrameShape>({ id, type: "frame", x: origin.x, y: origin.y, props: { w, h, name } });
      created.push(id);
      if (!instant) await sleep(CAMERA_MS);
      return id;
    },

    async add(kind: "node" | "edge", create: () => TLShapeId) {
      assertOpen();
      const id = create();
      created.push(id);
      if (instant) return;
      const shape = editor.getShape(id);
      if (shape) editor.animateShape({ id, type: shape.type, opacity: 1 }, { animation: { duration: FADE_MS } });
      await sleep((kind === "node" ? NODE_STEP_MS : EDGE_STEP_MS) * scale);
    },

    // Animations run on the editor's tick, which pauses in a background tab: set the final state
    // outright, so nothing is ever saved half-faded.
    async finish() {
      if (!instant) await sleep(FADE_MS);
      if (editor.isDisposed) return;
      const faded = created
        .map((id) => editor.getShape(id))
        .filter((shape): shape is TLShape => !!shape && shape.opacity !== 1)
        .map((shape) => ({ id: shape.id, type: shape.type, opacity: 1 }));
      if (faded.length) editor.updateShapes(faded);
    },
  };
}

// Clean, straight-edged connectors that route around shapes at right angles.
function createArrow(
  editor: Editor,
  { label, parentId, opacity }: { label?: string; parentId?: TLShapeId; opacity: number }
) {
  const id = createShapeId();
  editor.createShape<TLArrowShape>({
    id,
    type: "arrow",
    opacity,
    ...(parentId && { parentId }),
    props: {
      kind: "elbow",
      dash: "solid",
      size: "s",
      font: "sans",
      color: "grey",
      labelColor: "white",
      arrowheadEnd: "arrow",
      richText: toRichText(label ?? ""),
    },
  });
  return id;
}

// Binds an arrow end to a shape: to its center (tldraw finds the nearest edge), or, with `anchor`,
// to that exact point on it (0-1 of its width and height).
function bindArrow(
  editor: Editor,
  arrowId: TLShapeId,
  terminal: "start" | "end",
  toId: TLShapeId,
  anchor?: { x: number; y: number }
) {
  editor.createBinding<TLArrowBinding>({
    type: "arrow",
    fromId: arrowId,
    toId,
    props: {
      terminal,
      normalizedAnchor: anchor ?? { x: 0.5, y: 0.5 },
      isExact: false,
      isPrecise: !!anchor,
      snap: "none",
    },
  });
}

// A frame clips what's inside it, so when a table grows (update_table), its frame grows with it.
function growFrameToFit(editor: Editor, shapeId: TLShapeId) {
  const shape = editor.getShape(shapeId);
  const frame = shape && editor.getShape(shape.parentId as TLShapeId);
  if (!frame || frame.type !== "frame") return;
  const frameBounds = editor.getShapePageBounds(frame);
  if (!frameBounds) return;

  const { w, h } = (frame as TLFrameShape).props;
  let nextW = w;
  let nextH = h;
  for (const childId of editor.getSortedChildIdsForParent(frame.id)) {
    const child = editor.getShape(childId);
    if (!child || child.type === "arrow") continue;
    const bounds = editor.getShapePageBounds(child);
    if (!bounds) continue;
    nextW = Math.max(nextW, bounds.maxX - frameBounds.minX + FRAME_PAD);
    nextH = Math.max(nextH, bounds.maxY - frameBounds.minY + FRAME_PAD);
  }
  if (nextW !== w || nextH !== h) {
    editor.updateShape<TLFrameShape>({ id: frame.id, type: "frame", props: { w: nextW, h: nextH } });
  }
}

async function createTables(editor: Editor, input: z.infer<typeof createTablesInput>): Promise<ToolResult> {
  // One table per name; a repeated name keeps its first definition.
  const tables = [...new Map(input.tables.map((table) => [table.name.toLowerCase(), table])).values()];
  const newKeys = new Set(tables.map((table) => table.name.toLowerCase()));

  // Relations can also point at tables that were already on the canvas.
  const ids = new Map<string, TLShapeId>();
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type !== ENTITY_TABLE_TYPE) continue;
    const key = (shape as EntityTableShape).props.name.toLowerCase();
    if (!newKeys.has(key)) ids.set(key, shape.id);
  }
  const known = (name: string) => newKeys.has(name.toLowerCase()) || ids.has(name.toLowerCase());
  const relations = input.relations.filter((r) => known(r.fromTable) && known(r.toTable));
  const skipped = input.relations.filter((r) => !relations.includes(r)).map((r) => `${r.fromTable} → ${r.toTable}`);

  // Referenced tables (users) on the left, the tables that point at them to their right.
  const fieldsOf = (table: (typeof tables)[number]) =>
    table.fields.map((f) => ({ name: f.name, type: f.type, pk: !!f.pk, fk: !!f.fk }));
  const layout = layeredLayout(
    tables.map((table) => ({
      id: table.name.toLowerCase(),
      w: DEFAULT_W,
      h: heightFor(fieldsOf(table).map((field, i) => ({ ...field, id: String(i) }))),
    })),
    relations
      .filter((r) => newKeys.has(r.fromTable.toLowerCase()) && newKeys.has(r.toTable.toLowerCase()))
      .map((r) => ({ from: r.toTable.toLowerCase(), to: r.fromTable.toLowerCase() })),
    { direction: "horizontal", gapMain: 180, gapCross: 64, maxPerLayer: 3 }
  );

  const player = createPlayer(editor, { nodes: tables.length, edges: relations.length });
  const frameId = await player.openFrame(frameName("Database schema", input.title), layout);
  const byKey = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  let pending = relations;
  let drawnRelations = 0;

  for (const [index, key] of layout.order.entries()) {
    const table = byKey.get(key)!;
    const position = layout.positions.get(key)!;
    await player.add("node", () => {
      const id = createEntityTable(editor, {
        x: FRAME_PAD + position.x,
        y: FRAME_PAD + position.y,
        name: table.name,
        color: TABLE_COLORS[index % TABLE_COLORS.length],
        fields: fieldsOf(table),
        parentId: frameId,
        opacity: player.startOpacity,
      });
      ids.set(key, id);
      return id;
    });

    // Draw each relation as soon as both of its tables exist.
    const ready = pending.filter((r) => ids.has(r.fromTable.toLowerCase()) && ids.has(r.toTable.toLowerCase()));
    pending = pending.filter((r) => !ready.includes(r));
    for (const relation of ready) {
      const fromTable = editor.getShape(ids.get(relation.fromTable.toLowerCase())!) as EntityTableShape | undefined;
      const toTable = editor.getShape(ids.get(relation.toTable.toLowerCase())!) as EntityTableShape | undefined;
      if (!fromTable || !toTable) continue;
      const rowOf = (t: EntityTableShape, column: string) =>
        Math.max(0, t.props.fields.findIndex((f) => f.name.toLowerCase() === column.toLowerCase()));
      // Inside the frame only when both tables are; a relation to an older table spans frames.
      const inFrame = fromTable.parentId === frameId && toTable.parentId === frameId;

      await player.add("edge", () => {
        const arrowId = createArrow(editor, {
          label: relation.label,
          parentId: inFrame ? frameId : undefined,
          opacity: player.startOpacity,
        });
        connectTableRows(
          editor,
          arrowId,
          { tableId: fromTable.id, rowIndex: rowOf(fromTable, relation.fromColumn) },
          { tableId: toTable.id, rowIndex: rowOf(toTable, relation.toColumn) }
        );
        return arrowId;
      });
      drawnRelations++;
    }
  }

  await player.finish();
  return {
    ok: true,
    summary:
      `Drew a database schema with ${tables.length} table(s) and ${drawnRelations} relation(s).` +
      (skipped.length ? ` Skipped relations to unknown tables: ${skipped.join(", ")}.` : ""),
  };
}

// Sized to fit the label on one or two lines; tldraw grows the height if it needs more.
function nodeSize(shape: keyof typeof NODE_COLORS, label: string) {
  const longest = Math.max(...label.split("\n").map((line) => line.trim().length), 1);
  const textWidth = longest * 9.5;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const size =
    shape === "diamond"
      ? { w: clamp(textWidth * 1.5 + 80, 200, 340), h: 140 }
      : shape === "ellipse"
        ? { w: clamp(textWidth + 90, 180, 320), h: 96 }
        : { w: clamp(textWidth + 64, 180, 300), h: 84 };
  const lines = Math.ceil(textWidth / Math.max(size.w * (shape === "diamond" ? 0.55 : 0.8), 1));
  return { w: Math.round(size.w), h: size.h + Math.max(0, lines - 1) * 26 };
}

async function createDiagram(editor: Editor, input: z.infer<typeof createDiagramInput>): Promise<ToolResult> {
  const nodes = [...new Map(input.nodes.map((node) => [node.id, node])).values()];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = input.edges.filter((e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);

  // Flows read top to bottom; architecture and mind maps spread left to right.
  const direction =
    input.direction ?? (input.kind === "architecture" || input.kind === "mind_map" ? "horizontal" : "vertical");
  const horizontal = direction === "horizontal";
  // Labeled arrows need room for their label between layers.
  const labeled = edges.some((edge) => edge.label?.trim());
  const sizes = new Map(nodes.map((node) => [node.id, nodeSize(node.shape, node.label)]));
  const layout = layeredLayout(
    nodes.map((node) => ({ id: node.id, ...sizes.get(node.id)! })),
    edges,
    {
      direction,
      gapMain: horizontal ? (labeled ? 200 : 140) : labeled ? 130 : 90,
      gapCross: horizontal ? 56 : 72,
      maxPerLayer: 6,
    }
  );

  const name = frameName(DIAGRAM_KINDS[input.kind], input.title);
  const player = createPlayer(editor, { nodes: nodes.length, edges: edges.length });
  const frameId = await player.openFrame(name, layout);
  const shapeIds = new Map<string, TLShapeId>();
  let pending = edges;

  for (const nodeId of layout.order) {
    const node = byId.get(nodeId)!;
    const position = layout.positions.get(nodeId)!;
    const size = sizes.get(nodeId)!;
    await player.add("node", () => {
      const id = createShapeId();
      editor.createShape<TLGeoShape>({
        id,
        type: "geo",
        parentId: frameId,
        x: FRAME_PAD + position.x,
        y: FRAME_PAD + position.y,
        opacity: player.startOpacity,
        props: {
          geo: node.shape,
          w: size.w,
          h: size.h,
          richText: toRichText(node.label),
          color: node.color ?? NODE_COLORS[node.shape],
          labelColor: "white",
          fill: "solid",
          dash: "solid",
          size: "s",
          font: "sans",
        },
      });
      shapeIds.set(node.id, id);
      return id;
    });

    // Connect each arrow as soon as both of its ends exist, so the flow is drawn in reading order.
    const ready = pending.filter((edge) => shapeIds.has(edge.from) && shapeIds.has(edge.to));
    pending = pending.filter((edge) => !ready.includes(edge));
    for (const edge of ready) {
      // Arrows follow the flow: out of the bottom and into the top (right into left when horizontal).
      // A loop back (e.g. "No → try again") leaves and re-enters on the outer side instead: the left
      // in a top-down flow, the bottom in a left-to-right one, so it runs around the diagram.
      const loop = layout.backEdges.has(edge);
      const anchors = loop
        ? horizontal
          ? [{ x: 0.5, y: 1 }, { x: 0.5, y: 1 }]
          : [{ x: 0, y: 0.5 }, { x: 0, y: 0.5 }]
        : horizontal
          ? [{ x: 1, y: 0.5 }, { x: 0, y: 0.5 }]
          : [{ x: 0.5, y: 1 }, { x: 0.5, y: 0 }];
      await player.add("edge", () => {
        const arrowId = createArrow(editor, { label: edge.label, parentId: frameId, opacity: player.startOpacity });
        bindArrow(editor, arrowId, "start", shapeIds.get(edge.from)!, anchors[0]);
        bindArrow(editor, arrowId, "end", shapeIds.get(edge.to)!, anchors[1]);
        return arrowId;
      });
    }
  }

  await player.finish();
  return {
    ok: true,
    summary: `Drew "${name}" with ${nodes.length} node(s) and ${edges.length} connection(s).`,
  };
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
  growFrameToFit(editor, table.id);
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

const NOT_OPEN = {
  canvas: "The canvas isn't open in the current view. Ask the user to switch to the Canvas or Both view.",
  doc: "The doc isn't open in the current view. Ask the user to switch to the Doc or Both view.",
};

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

// Like the canvas, the doc fills in step by step: one block at a time, faster for long docs.
const DOC_BLOCK_MS = 90;
const MAX_DOC_WRITE_MS = 4000;

async function writeDoc(editor: DocEditor, input: z.infer<typeof writeDocInput>): Promise<ToolResult> {
  const blocks = parseMarkdown(editor, input.markdown);
  if (blocks.length === 0) return { ok: false, error: "The markdown was empty." };
  const delay = prefersReducedMotion() ? 0 : Math.min(DOC_BLOCK_MS, MAX_DOC_WRITE_MS / blocks.length);

  const [first, ...rest] = blocks;
  let lastId =
    input.mode === "replace" || isBlank(editor)
      ? editor.replaceBlocks(editor.document, [first]).insertedBlocks.at(-1)!.id
      : editor.insertBlocks([first], editor.document[editor.document.length - 1], "after").at(-1)!.id;

  let written = 1;
  try {
    for (const block of rest) {
      if (delay) await sleep(delay);
      lastId = editor.insertBlocks([block], lastId, "after").at(-1)!.id;
      written++;
    }
  } catch {
    // The doc view was closed mid-write.
    return {
      ok: false,
      error: `The doc was closed while writing; ${written} of ${blocks.length} block(s) were written. ${NOT_OPEN.doc}`,
    };
  }
  return { ok: true, summary: `Wrote ${blocks.length} block(s) to the doc (${input.mode}).` };
}

// ─── Dispatch ────────────────────────────────────────────────────────────────────────────────────


// Each surface draws one thing at a time: two drawings started together would pick the same empty
// spot. The doc and the canvas still fill in side by side.
const queues = { canvas: Promise.resolve(), doc: Promise.resolve() };
const DOC_TOOLS = new Set(["write_doc", "edit_doc"]);

export function runAgentTool(toolName: string, rawInput: unknown, editors: Editors): Promise<ToolResult> {
  const surface = DOC_TOOLS.has(toolName) ? "doc" : "canvas";
  const result = queues[surface].then(() => runTool(toolName, rawInput, editors));
  queues[surface] = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function runTool(toolName: string, rawInput: unknown, { canvasEditor, docEditor }: Editors): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "create_tables": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        const input = createTablesInput.parse(rawInput);
        canvasEditor.markHistoryStoppingPoint("agent: create tables");
        return await createTables(canvasEditor, input);
      }
      case "create_diagram": {
        if (!canvasEditor) return { ok: false, error: NOT_OPEN.canvas };
        const input = createDiagramInput.parse(rawInput);
        canvasEditor.markHistoryStoppingPoint("agent: create diagram");
        return await createDiagram(canvasEditor, input);
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
        return await writeDoc(docEditor, writeDocInput.parse(rawInput));
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
