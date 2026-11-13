"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Columns2, Eye, FileText, LayoutGrid } from "lucide-react";
import type { TLEditorSnapshot } from "tldraw";
import type { PartialBlock } from "@blocknote/core";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";

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
      <header className="relative z-40 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/8 bg-[linear-gradient(180deg,oklch(0.16_0.005_285/0.92),oklch(0.135_0.004_285/0.88))] px-3 backdrop-blur-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[linear-gradient(90deg,transparent,oklch(0.74_0.16_55/0.3)_50%,transparent)]"
        />
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            aria-label="Outpost"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25 transition-colors hover:bg-primary/15"
          >
            <Image src="/brand/mascot-dark.png" alt="Outpost" width={18} height={18} className="size-4.5" />
          </Link>
          <span className="h-5 w-px shrink-0 bg-white/10" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{name}</p>
            {description && <p className="truncate text-[11px] text-muted-foreground">{description}</p>}
          </div>
        </div>

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

        <div className="flex items-center justify-end gap-2">
          <span
            title="You can look around, but not edit"
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-3 text-[11px] text-muted-foreground"
          >
            <Eye className="size-3.5" />
            <span className="hidden lg:inline">View only</span>
          </span>
          {/* Viewers arrive without an account: a way to make their own. */}
          <Button asChild size="sm" className="h-8 rounded-full px-3.5">
            <Link href="/">
              <span className="hidden md:inline">Try Outpost free</span>
              <span className="md:hidden">Try free</span>
              <ArrowRight data-icon="inline-end" className="hidden sm:block" />
            </Link>
          </Button>
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
  return (
    <div className="bg-dots flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <span className="flex size-10 items-center justify-center rounded-xl bg-white/4 ring-1 ring-white/8">
        <FileText className="size-4" />
      </span>
      {label}
    </div>
  );
}
