"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapeId,
  resizeBox,
  useEditor,
  useValue,
  type Editor,
  type RecordProps,
  type TLResizeInfo,
  type TLShape,
  type TLShapeId,
} from "tldraw";
import { KeyRound, Link2, Plus, Table2, X } from "lucide-react";

// ─── Shape definition ──────────────────────────────────────────────────────────────────────────

export const ENTITY_TABLE_TYPE = "entity-table" as const;

export type EntityField = {
  id: string;
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
};

export type EntityTableProps = {
  w: number;
  h: number;
  name: string;
  color: string;
  fields: EntityField[];
};

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    [ENTITY_TABLE_TYPE]: EntityTableProps;
  }
}

export type EntityTableShape = TLShape<typeof ENTITY_TABLE_TYPE>;

// Layout, shared with snapArrowToRow so arrows land on the middle of a row.
export const HEADER_H = 44;
export const ROW_H = 30;
const FOOTER_H = 8;
const MIN_W = 220;
export const DEFAULT_W = 280;

export const TABLE_COLORS = ["#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#ef4444"];

export function heightFor(fields: EntityField[]) {
  return HEADER_H + Math.max(fields.length, 1) * ROW_H + FOOTER_H;
}

// Y of a row's center, relative to the top of the table.
export function rowCenterY(index: number) {
  return HEADER_H + index * ROW_H + ROW_H / 2;
}

let fieldCounter = 0;
export function newFieldId() {
  fieldCounter += 1;
  return `f${Date.now().toString(36)}${fieldCounter.toString(36)}`;
}

// Used by the toolbar button and the agent alike.
export function createEntityTable(
  editor: Editor,
  {
    x,
    y,
    name,
    color,
    fields,
    w = DEFAULT_W,
    id = createShapeId(),
  }: {
    x: number;
    y: number;
    name: string;
    color?: string;
    fields: Omit<EntityField, "id">[];
    w?: number;
    id?: TLShapeId;
  }
) {
  const withIds = fields.map((field) => ({ ...field, id: newFieldId() }));
  editor.createShape<EntityTableShape>({
    id,
    type: ENTITY_TABLE_TYPE,
    x,
    y,
    props: {
      w,
      h: heightFor(withIds),
      name,
      color: color ?? TABLE_COLORS[editor.getCurrentPageShapeIds().size % TABLE_COLORS.length],
      fields: withIds,
    },
  });
  return id;
}

export class EntityTableShapeUtil extends BaseBoxShapeUtil<EntityTableShape> {
  static override type = ENTITY_TABLE_TYPE;

  static override props: RecordProps<EntityTableShape> = {
    w: T.number,
    h: T.number,
    name: T.string,
    color: T.string,
    fields: T.arrayOf(
      T.object({
        id: T.string,
        name: T.string,
        type: T.string,
        pk: T.boolean,
        fk: T.boolean,
      })
    ),
  };

  override getDefaultProps(): EntityTableProps {
    const fields: EntityField[] = [{ id: newFieldId(), name: "id", type: "uuid", pk: true, fk: false }];
    return { w: DEFAULT_W, h: heightFor(fields), name: "new_table", color: TABLE_COLORS[0], fields };
  }

  override getShapeName(shape: EntityTableShape) {
    return shape.props.name;
  }

  override canEdit() {
    return true;
  }

  // Width is free; height always follows the column count.
  override onResize(shape: EntityTableShape, info: TLResizeInfo<EntityTableShape>) {
    const resized = resizeBox(shape, info, { minWidth: MIN_W });
    return { ...resized, props: { ...resized.props, h: heightFor(shape.props.fields) } };
  }

  override component(shape: EntityTableShape) {
    return <EntityTableComponent shape={shape} />;
  }

  override getIndicatorPath(shape: EntityTableShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
    return path;
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────────────────────────

// Inputs inside the shape must keep pointer events to themselves, or tldraw starts a drag.
const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

function EntityTableComponent({ shape }: { shape: EntityTableShape }) {
  const editor = useEditor();
  const isEditing = useValue("isEditingTable", () => editor.getEditingShapeId() === shape.id, [editor, shape.id]);
  const { w, h, name, color, fields } = shape.props;

  const update = (patch: Partial<Omit<EntityTableProps, "h" | "w">>) => {
    const nextFields = patch.fields ?? fields;
    editor.updateShape<EntityTableShape>({
      id: shape.id,
      type: ENTITY_TABLE_TYPE,
      props: { ...patch, h: heightFor(nextFields) },
    });
  };

  const updateField = (id: string, patch: Partial<EntityField>) =>
    update({ fields: fields.map((field) => (field.id === id ? { ...field, ...patch } : field)) });

  const exitOnEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") editor.setEditingShape(null);
  };

  return (
    <HTMLContainer
      style={{ width: w, height: h, pointerEvents: isEditing ? "all" : "none", overflow: "visible" }}
    >
      <div
        className="relative flex size-full flex-col overflow-hidden rounded-xl border bg-[#18181b] font-sans text-zinc-100 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
        style={{
          borderColor: isEditing ? color : "rgba(255,255,255,0.1)",
          boxShadow: isEditing ? `0 0 0 3px ${color}33, 0 18px 40px -12px rgba(0,0,0,0.7)` : undefined,
        }}
      >
        {/* Header */}
        <div
          className="relative flex shrink-0 items-center gap-2 border-b border-white/8 px-3"
          style={{ height: HEADER_H, background: `linear-gradient(180deg, ${color}2e 0%, ${color}0d 100%)` }}
        >
          <span className="absolute inset-x-0 top-0 h-0.75" style={{ background: color }} />
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${color}26`, color }}
          >
            <Table2 className="size-3.5" />
          </span>
          {isEditing ? (
            <input
              value={name}
              onChange={(e) => update({ name: e.target.value.replace(/\s+/g, "_") })}
              onPointerDown={stop}
              onKeyDown={exitOnEscape}
              autoFocus
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[13px] font-semibold outline-none focus:border-white/30"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">{name}</span>
          )}
          {isEditing ? (
            <div className="flex shrink-0 items-center gap-1">
              {TABLE_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onPointerDown={stop}
                  onClick={() => update({ color: swatch })}
                  className="size-3 rounded-full ring-offset-1 ring-offset-[#18181b] transition-transform hover:scale-125"
                  style={{ background: swatch, boxShadow: swatch === color ? `0 0 0 2px ${swatch}` : undefined }}
                  aria-label={`Color ${swatch}`}
                />
              ))}
            </div>
          ) : (
            <span className="shrink-0 rounded-full bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {fields.length}
            </span>
          )}
        </div>

        {/* Rows */}
        <div className="flex-1">
          {fields.length === 0 && (
            <div className="flex items-center px-3 text-[12px] italic text-zinc-500" style={{ height: ROW_H }}>
              No columns yet
            </div>
          )}
          {fields.map((field, index) => (
            <div
              key={field.id}
              className={`group flex items-center gap-2 px-3 ${index % 2 === 1 ? "bg-white/2" : ""}`}
              style={{ height: ROW_H }}
            >
              {isEditing ? (
                <>
                  <KeyToggle
                    active={field.pk}
                    label="Primary key"
                    onToggle={() => updateField(field.id, { pk: !field.pk })}
                    tone="#f59e0b"
                  >
                    <KeyRound className="size-3" />
                  </KeyToggle>
                  <KeyToggle
                    active={field.fk}
                    label="Foreign key"
                    onToggle={() => updateField(field.id, { fk: !field.fk })}
                    tone="#60a5fa"
                  >
                    <Link2 className="size-3" />
                  </KeyToggle>
                  <input
                    value={field.name}
                    onChange={(e) => updateField(field.id, { name: e.target.value.replace(/\s+/g, "_") })}
                    onPointerDown={stop}
                    onKeyDown={exitOnEscape}
                    placeholder="column"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded border border-transparent bg-black/25 px-1.5 py-0.5 text-[12px] outline-none focus:border-white/25"
                  />
                  <input
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value })}
                    onPointerDown={stop}
                    onKeyDown={exitOnEscape}
                    placeholder="type"
                    spellCheck={false}
                    className="w-20 rounded border border-transparent bg-black/25 px-1.5 py-0.5 text-right font-mono text-[11px] text-zinc-400 outline-none focus:border-white/25"
                  />
                  <button
                    type="button"
                    onPointerDown={stop}
                    onClick={() => update({ fields: fields.filter((f) => f.id !== field.id) })}
                    className="flex size-5 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-red-500/15 hover:text-red-400"
                    aria-label={`Remove ${field.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex w-4 shrink-0 justify-center">
                    {field.pk ? (
                      <KeyRound className="size-3 text-amber-400" />
                    ) : field.fk ? (
                      <Link2 className="size-3 text-blue-400" />
                    ) : (
                      <span className="size-1 rounded-full bg-zinc-600" />
                    )}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[12px] ${field.pk ? "font-semibold text-zinc-50" : "text-zinc-200"}`}
                  >
                    {field.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-500">{field.type}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {isEditing && (
        <button
          type="button"
          onPointerDown={stop}
          onClick={() =>
            update({ fields: [...fields, { id: newFieldId(), name: "column", type: "text", pk: false, fk: false }] })
          }
          className="absolute left-1/2 mt-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#18181b] px-3 py-1 text-[11px] font-medium text-zinc-300 shadow-lg transition-colors hover:border-white/25 hover:text-white"
          style={{ top: "100%" }}
        >
          <Plus className="size-3" />
          Add column
        </button>
      )}
    </HTMLContainer>
  );
}

function KeyToggle({
  active,
  label,
  onToggle,
  tone,
  children,
}: {
  active: boolean;
  label: string;
  onToggle: () => void;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={stop}
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="flex size-5 shrink-0 items-center justify-center rounded transition-colors"
      style={{ color: active ? tone : "#52525b", background: active ? `${tone}22` : "transparent" }}
    >
      {children}
    </button>
  );
}
