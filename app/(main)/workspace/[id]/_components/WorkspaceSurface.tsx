"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Columns2, FileText, LayoutGrid } from "lucide-react";
import type { TLEditorSnapshot } from "tldraw";
import type { PartialBlock } from "@blocknote/core";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

// Both editors touch window and measure the DOM, so they render in the browser only.
const CanvasEditor = dynamic(() => import("./CanvasEditor").then((m) => m.CanvasEditor), {
  ssr: false,
  loading: () => <SurfaceLoading label="Loading canvas" />,
});
const DocEditor = dynamic(() => import("@/components/DocEditor").then((m) => m.DocEditor), {
  ssr: false,
  loading: () => <SurfaceLoading label="Loading doc" />,
});

type View = "doc" | "both" | "canvas";

const VIEWS: { view: View; label: string; icon: typeof FileText }[] = [
  { view: "doc", label: "Doc", icon: FileText },
  { view: "both", label: "Both", icon: Columns2 },
  { view: "canvas", label: "Canvas", icon: LayoutGrid },
];

// The last view is remembered per browser.
const VIEW_KEY = "outpost:workspace-view";
const viewListeners = new Set<() => void>();
const subscribeView = (listener: () => void) => {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
};
const readView = (): View => {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "doc" || stored === "both" || stored === "canvas") return stored;
  } catch {}
  return "both";
};
const writeView = (view: View) => {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {}
  viewListeners.forEach((listener) => listener());
};

export function WorkspaceSurface({
  workspaceId,
  initialDoc,
  initialDocState,
  initialCanvas,
  left,
  right,
}: {
  workspaceId: string;
  initialDoc: PartialBlock[] | null;
  initialDocState: string | null;
  initialCanvas: TLEditorSnapshot | null;
  left: ReactNode;
  right: ReactNode;
}) {
  const view = useSyncExternalStore(subscribeView, readView, () => "both" as View);
  // Latest Yjs state, copied into docSeed on a view switch, so a re-mounted doc editor starts
  // from the current text rather than what the page first loaded.
  const latestDocState = useRef(initialDocState);
  const [docSeed, setDocSeed] = useState(initialDocState);

  const setView = (next: View) => {
    setDocSeed(latestDocState.current);
    writeView(next);
  };

  const doc = (
    <DocEditor
      workspaceId={workspaceId}
      initialContent={initialDoc}
      initialState={docSeed}
      onStateChange={(state) => (latestDocState.current = state)}
    />
  );
  const canvas = <CanvasEditor workspaceId={workspaceId} initialSnapshot={initialCanvas} />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="relative z-40 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/8 bg-background/85 px-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1.5">{left}</div>

        <nav
          aria-label="Workspace view"
          className="flex items-center gap-0.5 rounded-lg border border-white/8 bg-white/3 p-0.5"
        >
          {VIEWS.map(({ view: option, label, icon: Icon }) => {
            const active = option === view;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "bg-white/10 text-foreground shadow-sm ring-1 ring-white/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`size-3.5 ${active ? "text-primary" : ""}`} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">{right}</div>
      </header>

      <main className="relative min-h-0 flex-1">
        {view === "both" ? (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="42" minSize={320} className="bg-card/40">
              {doc}
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-white/8" />
            <ResizablePanel minSize={360}>{canvas}</ResizablePanel>
          </ResizablePanelGroup>
        ) : view === "doc" ? (
          <div className="h-full bg-card/40">{doc}</div>
        ) : (
          canvas
        )}
      </main>
    </div>
  );
}

function SurfaceLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-3.5 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
        {label}
      </div>
    </div>
  );
}
