import {
  Box,
  Editor,
  createTLStore,
  defaultAddFontsFromNode,
  defaultBindingUtils,
  defaultShapeUtils,
  tipTapDefaultExtensions,
} from "tldraw";
import { EntityTableShapeUtil } from "@/components/EntityTable/EntityTableShapeUtil";

// A real tldraw Editor with no UI, for testing code that reads or changes the canvas.
export function createTestEditor() {
  const shapeUtils = [...defaultShapeUtils, EntityTableShapeUtil];
  const store = createTLStore({ shapeUtils, bindingUtils: defaultBindingUtils });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const editor = new Editor({
    store,
    shapeUtils,
    bindingUtils: defaultBindingUtils,
    tools: [],
    getContainer: () => container,
    // What <Tldraw> passes by default; shapes with labels need it to read their text.
    options: {
      text: { addFontsFromNode: defaultAddFontsFromNode, tipTapConfig: { extensions: tipTapDefaultExtensions } },
    },
  });
  editor.updateViewportScreenBounds(new Box(0, 0, 1600, 900));
  return editor;
}
