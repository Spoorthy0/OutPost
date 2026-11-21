"use client";

import {
  Box,
  FrameShapeUtil,
  type FrameShapeOptions,
  react,
  type Editor,
  type TLFrameShape,
  type TLShape,
  type TLShapeId,
  type TLShapePartial,
} from "tldraw";
import { DIAGRAM_KINDS } from "@/lib/agent-tools";

// The agent draws each ERD or diagram inside a frame. tldraw's frames are built for slides: they
// clip what's inside and resize without their content, so a table dragged to the edge got cut off
// and enlarging the box only added empty space. A diagram frame instead never clips and fits
// itself to its content, like a section in Figma: drag a table past the edge and the box grows,
// drop it well outside and it leaves the diagram while the box shrinks back.

// Space between the content and the box, on every side.
export const DIAGRAM_FRAME_PAD = 72;

// The app's primary orange (globals.css --primary, oklch(0.74 0.16 55)).
const BRAND = "#f68c36";
const tint = (alpha: number) =>
  `${BRAND}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

// Older diagrams were drawn before frames were tagged, so their title also identifies them.
const DIAGRAM_TITLES = ["Database schema", ...Object.values(DIAGRAM_KINDS)];

export function isDiagramFrame(shape: TLShape | undefined): shape is TLFrameShape {
  if (!shape || shape.type !== "frame") return false;
  if (shape.meta?.diagram === true) return true;
  const name = (shape as TLFrameShape).props.name;
  return DIAGRAM_TITLES.some((title) => name === title || name.startsWith(`${title} · `));
}

export class DiagramFrameShapeUtil extends FrameShapeUtil {
  override options: FrameShapeOptions = {
    ...this.options,
    getCustomDisplayValues: (_editor: Editor, shape: TLFrameShape) =>
      isDiagramFrame(shape)
        ? {
            fillColor: tint(0.03),
            strokeColor: tint(0.35),
            headingFillColor: tint(0.14),
            headingStrokeColor: tint(0.35),
            headingTextColor: BRAND,
          }
        : {},
  };

  // Its size follows its content, so there's nothing to resize by hand.
  override canResize(shape: TLFrameShape) {
    return !isDiagramFrame(shape);
  }

  override getClipPath(shape: TLFrameShape) {
    return isDiagramFrame(shape) ? undefined : super.getClipPath(shape);
  }
}

// Frames the agent is still drawing in: fitting them now would shrink the box around the first
// shape and grow it again with every step.
const drawing = new WeakMap<Editor, Set<TLShapeId>>();
const drawingIn = (editor: Editor) => {
  let set = drawing.get(editor);
  if (!set) drawing.set(editor, (set = new Set()));
  return set;
};
export function holdDiagramFit(editor: Editor, frameId: TLShapeId) {
  drawingIn(editor).add(frameId);
}
export function releaseDiagramFit(editor: Editor, frameId: TLShapeId) {
  drawingIn(editor).delete(frameId);
  fitDiagramFrame(editor, frameId);
}

// Resizes the frame to its content plus padding, keeping every shape where it is on the page.
// Arrows don't count: one that leads to a table moved out of the diagram would stretch the box.
export function fitDiagramFrame(editor: Editor, frameId: TLShapeId) {
  const frame = editor.getShape(frameId);
  if (!isDiagramFrame(frame) || frame.isLocked || drawingIn(editor).has(frameId)) return;

  const children = editor
    .getSortedChildIdsForParent(frameId)
    .map((id) => editor.getShape(id))
    .filter((shape): shape is TLShape => !!shape);
  const content = children.filter((shape) => shape.type !== "arrow");
  if (!content.length) return;

  const bounds = Box.Common(
    content.map((shape) => {
      const geometry = editor.getShapeGeometry(shape.id);
      return Box.FromPoints(editor.getShapeLocalTransform(shape).applyToPoints(geometry.vertices));
    })
  );
  const dx = DIAGRAM_FRAME_PAD - bounds.minX;
  const dy = DIAGRAM_FRAME_PAD - bounds.minY;
  const w = bounds.w + DIAGRAM_FRAME_PAD * 2;
  const h = bounds.h + DIAGRAM_FRAME_PAD * 2;

  // Already fits. The tolerance also keeps undo from refitting a state it has just restored.
  const close = (a: number, b: number) => Math.abs(a - b) < 0.5;
  if (close(dx, 0) && close(dy, 0) && close(w, frame.props.w) && close(h, frame.props.h)) return;

  // Children are placed relative to the frame: shift them by (dx, dy) and the frame the other way.
  const origin = editor.getPointInParentSpace(
    frame,
    editor.getShapePageTransform(frame).applyToPoint({ x: -dx, y: -dy })
  );
  const changes: TLShapePartial[] = children.map((shape) => ({
    id: shape.id,
    type: shape.type,
    x: shape.x + dx,
    y: shape.y + dy,
  }));
  changes.push({
    id: frame.id,
    type: "frame",
    x: origin.x,
    y: origin.y,
    props: { w, h },
  });
  editor.updateShapes(changes);
}

const INTERACTIONS = ["select.translating", "select.resizing", "select.rotating", "select.dragging_handle"];

// Keeps diagram frames fitted to their content as people edit them. Fitting waits until a drag
// ends: tldraw moves a shape out of a frame when it's dropped outside it, and a box that grew
// under the pointer would never let it go.
export function registerDiagramFrameFitting(editor: Editor) {
  const pending = new Set<TLShapeId>();
  let fitting = false;

  const queue = (parentId: TLShape["parentId"]) => {
    if (fitting) return;
    const parent = editor.getShape(parentId as TLShapeId);
    if (isDiagramFrame(parent)) pending.add(parent.id);
  };

  const flush = () => {
    if (!pending.size || editor.isDisposed || editor.isInAny(...INTERACTIONS)) return;
    const ids = [...pending];
    pending.clear();
    fitting = true;
    try {
      editor.run(() => ids.forEach((id) => fitDiagramFrame(editor, id)));
    } finally {
      fitting = false;
    }
  };

  // Changes from collaborators are fitted on their own screen; fitting here too would fight them.
  const cleanups = [
    editor.sideEffects.registerAfterCreateHandler("shape", (shape, source) => {
      if (source === "user") queue(shape.parentId);
    }),
    editor.sideEffects.registerAfterChangeHandler("shape", (prev, next, source) => {
      if (source !== "user") return;
      queue(next.parentId);
      if (prev.parentId !== next.parentId) queue(prev.parentId);
    }),
    editor.sideEffects.registerAfterDeleteHandler("shape", (shape, source) => {
      if (source === "user") queue(shape.parentId);
    }),
    // After each edit (a whole edit, not halfway through a batch of shape updates)...
    editor.sideEffects.registerOperationCompleteHandler(flush),
    // ...and when a drag, resize or rotation ends.
    react("fit diagram frames after a drag", () => {
      if (!editor.isInAny(...INTERACTIONS)) flush();
    }),
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
}
