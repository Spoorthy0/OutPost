"use client";

import { Tldraw, type Editor, type TLEditorSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { EntityTableShapeUtil } from "@/components/EntityTable/EntityTableShapeUtil";

const shapeUtils = [EntityTableShapeUtil];

// The canvas as last saved (Canvas.content), loaded locally with no sync and no saving. Viewers
// can pan and zoom, but not change anything.
export function ReadOnlyCanvas({ snapshot }: { snapshot: TLEditorSnapshot }) {
  const handleMount = (editor: Editor) => {
    editor.updateInstanceState({ isReadonly: true });
    editor.zoomToFit({ animation: { duration: 0 } });
  };

  return (
    // isolate keeps tldraw's high z-index layers inside the canvas.
    <div className="isolate h-full">
      <Tldraw
        snapshot={snapshot}
        shapeUtils={shapeUtils}
        onMount={handleMount}
        hideUi
        colorScheme="dark"
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      />
    </div>
  );
}
