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
  startInBothView = false,
  left,
  right,
}: {
  workspaceId: string;
  initialDoc: PartialBlock[] | null;
  initialDocState: string | null;
  initialCanvas: TLEditorSnapshot | null;
  // A prompt from the dashboard waits for both editors so the agent can draw and write, so the
  // workspace opens in Both regardless of the remembered view, until the user picks another one.
  startInBothView?: boolean;
  left: ReactNode;
  right: ReactNode;
}) {
  const storedView = useSyncExternalStore(subscribeView, readView, () => "both" as View);
  const [forceBoth, setForceBoth] = useState(startInBothView);
  const view = forceBoth ? "both" : storedView;
  // Latest Yjs state, copied into docSeed on a view switch, so a re-mounted doc editor starts
  // from the current text rather than what the page first loaded.
  const latestDocState = useRef(initialDocState);
  const [docSeed, setDocSeed] = useState(initialDocState);

  const setView = (next: View) => {
    if (next === view) return;
    setDocSeed(latestDocState.current);
    setForceBoth(false);
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
      <header className="relative z-40 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/8 bg-[linear-gradient(180deg,oklch(0.16_0.005_285/0.92),oklch(0.135_0.004_285/0.88))] px-3 backdrop-blur-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[linear-gradient(90deg,transparent,oklch(0.74_0.16_55/0.3)_50%,transparent)]"
        />
        <div className="flex min-w-0 items-center gap-1.5">{left}</div>

        <nav
          aria-label="Workspace view"
          className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-black/25 p-1 shadow-[inset_0_1px_2px_oklch(0_0_0/0.4)]"
        >
          {VIEWS.map(({ view: option, label, icon: Icon }) => {
            const active = option === view;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  active
                    ? "bg-[linear-gradient(180deg,oklch(1_0_0/0.12),oklch(1_0_0/0.06))] text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_1px_3px_oklch(0_0_0/0.5)] ring-1 ring-white/10"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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
