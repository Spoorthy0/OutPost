"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Columns2, Eye, FileText, LayoutGrid } from "lucide-react";
import type { TLEditorSnapshot } from "tldraw";
import type { PartialBlock } from "@blocknote/core";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";

// Both viewers touch window and measure the DOM, so they render in the browser only.
const ReadOnlyDoc = dynamic(() => import("./ReadOnlyDoc").then((m) => m.ReadOnlyDoc), {
  ssr: false,
  loading: () => <Loading label="Loading doc" />,
});
const ReadOnlyCanvas = dynamic(() => import("./ReadOnlyCanvas").then((m) => m.ReadOnlyCanvas), {
  ssr: false,
  loading: () => <Loading label="Loading canvas" />,
});

type View = "doc" | "both" | "canvas";

const VIEWS: { view: View; label: string; icon: typeof FileText }[] = [
  { view: "doc", label: "Doc", icon: FileText },
  { view: "both", label: "Both", icon: Columns2 },
  { view: "canvas", label: "Canvas", icon: LayoutGrid },
];

export function SharedSurface({
  name,
  description,
  doc,
  canvas,
}: {
  name: string;
  description: string | null;
  doc: PartialBlock[] | null;
  canvas: TLEditorSnapshot | null;
}) {
  // Start on whichever side has content.
  const [view, setView] = useState<View>(doc && canvas ? "both" : canvas ? "canvas" : "doc");

  const docPane = doc ? <ReadOnlyDoc content={doc} /> : <Empty label="This doc is empty" />;
  const canvasPane = canvas ? <ReadOnlyCanvas snapshot={canvas} /> : <Empty label="This canvas is empty" />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/8 bg-background px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" aria-label="Outpost" className="shrink-0">
            <Image src="/brand/mascot.png" alt="Outpost" width={20} height={20} className="size-5" />
          </Link>
          <span className="h-5 w-px shrink-0 bg-white/10" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{name}</p>
            {description && <p className="truncate text-[11px] text-muted-foreground">{description}</p>}
          </div>
        </div>

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

        <div className="flex justify-end">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-[11px] text-muted-foreground">
            <Eye className="size-3.5" />
            <span className="hidden sm:inline">View only</span>
          </span>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {view === "both" ? (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="42" minSize={320} className="bg-card/40">
              {docPane}
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-white/8" />
            <ResizablePanel minSize={360}>{canvasPane}</ResizablePanel>
          </ResizablePanelGroup>
        ) : view === "doc" ? (
          <div className="h-full bg-card/40">{docPane}</div>
        ) : (
          canvasPane
        )}
      </main>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-3.5 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
        {label}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
