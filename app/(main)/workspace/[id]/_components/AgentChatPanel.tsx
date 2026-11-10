"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  Eraser,
  FileText,
  GitFork,
  Loader2,
  RotateCcw,
  Square,
  Table2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { isToolUIPart, isDynamicToolUIPart } from "ai";
import type { WorkspaceAgentChat } from "@/hooks/use-workspace-agent-chat";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MicButton } from "@/components/MicButton";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { PROMPT_LIMIT_ERROR, UPGRADE_REASONS } from "@/lib/plan-limits";
import { submitOnEnter } from "@/lib/utils";

const SUGGESTIONS = [
  "Design a database for a blog and document each table",
  "Draw the signup and onboarding flow",
  "Write a project brief in the doc",
];

const TOOL_LABELS: Record<string, { running: string; done: string; icon: LucideIcon }> = {
  create_tables: { running: "Drawing tables", done: "Drew tables", icon: Table2 },
  create_diagram: { running: "Drawing diagram", done: "Drew diagram", icon: GitFork },
  write_doc: { running: "Writing the doc", done: "Updated the doc", icon: FileText },
  clear_canvas: { running: "Clearing canvas", done: "Cleared the canvas", icon: Eraser },
};

type ToolOutput = { ok: boolean; summary?: string; error?: string } | undefined;

export function AgentChatPanel({ chat, isReady }: { chat: WorkspaceAgentChat; isReady: boolean }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const { messages, sendMessage, stop, status, error, setMessages, clearError } = chat;
  const openUpgrade = useUpgradeDialog();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  // Follow the conversation as it streams.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    const trimmed = text.trim();
    // Enter must not send mid-response either: a second request running alongside the first
    // makes the SDK re-add the in-progress assistant message, duplicating its id.
    if (!trimmed || !isReady || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const resetChat = () => {
    stop();
    clearError();
    setMessages([]);
  };

  return (
    // A resizable group of its own, laid over the workspace below the header, so opening the chat
    // doesn't resize the doc and canvas. The empty left panel lets clicks through to the editors;
    // only the handle and the chat itself take them. Sizes are in px.
    <div className="pointer-events-none fixed inset-x-0 top-14 bottom-0 z-30">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel />
        <ResizableHandle className="pointer-events-auto bg-transparent" />
        <ResizablePanel
          defaultSize={380}
          minSize={300}
          maxSize={640}
          className="pointer-events-auto relative flex flex-col overflow-hidden border-l border-white/10 bg-card/95 shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in slide-in-from-right-8 fade-in duration-200"
        >
          {/* Soft amber glow behind the header */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,oklch(0.74_0.16_55/0.14),transparent_70%)]" />

          <div className="relative flex h-14 shrink-0 items-center gap-2.5 border-b border-white/6 px-4">
            <span className="relative flex size-7 items-center justify-center rounded-lg bg-primary/12 ring-1 ring-primary/25">
              <Image src="/brand/mascot-dark.png" alt="" width={18} height={18} className="size-4.5" />
              <span
                className={`absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-card ${
                  !isReady ? "bg-zinc-500" : isBusy ? "animate-pulse bg-primary" : "bg-emerald-400"
                }`}
              />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Outpost Agent</p>
              <p className="text-[11px] text-muted-foreground">
                {!isReady ? "Waiting for the editors…" : isBusy ? "Working…" : "Draws and writes with you"}
              </p>
            </div>
            {messages.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={resetChat}
                className="size-7 text-muted-foreground"
                aria-label="New chat"
                title="New chat"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>

          <div ref={scrollRef} className="relative flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-center gap-5 pb-10">
                <div className="space-y-2 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                    <Wand2 className="size-5 text-primary" />
                  </div>
                  <p className="font-heading text-lg font-semibold">What should we build?</p>
                  <p className="mx-auto max-w-64 text-xs leading-relaxed text-muted-foreground">
                    Ask for a diagram, a doc, or both. Say &ldquo;in the doc&rdquo; or &ldquo;on the
                    canvas&rdquo; to keep it to one side.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      disabled={!isReady}
                      className="group flex w-full items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/35 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
                    >
                      {suggestion}
                      <ArrowUp className="size-3.5 shrink-0 rotate-45 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-lg shadow-primary/10">
                      {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="space-y-2 text-sm">
                    {message.parts.map((part, i) => {
                      if (part.type === "reasoning") {
                        const isStreaming = part.state === "streaming";
                        if (!part.text && !isStreaming) return null;
                        return (
                          <details
                            key={i}
                            open={isStreaming}
                            className="group rounded-xl border border-blue-400/10 bg-blue-400/3 px-3 py-2"
                          >
                            <summary className="flex cursor-pointer list-none items-center gap-1.5">
                              <Wand2
                                className={`size-3 shrink-0 text-blue-400/70 ${isStreaming ? "animate-pulse" : ""}`}
                              />
                              <span className="text-[10px] font-medium tracking-wider text-blue-300/60 uppercase">
                                {isStreaming ? "Thinking…" : "Agent reasoning"}
                              </span>
                            </summary>
                            {part.text && (
                              <p className="mt-1.5 text-[12px] leading-relaxed whitespace-pre-wrap text-white/40">
                                {part.text}
                                {isStreaming && (
                                  <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-blue-400/60 align-middle" />
                                )}
                              </p>
                            )}
                          </details>
                        );
                      }
                      if (part.type === "text") {
                        if (!part.text.trim()) return null;
                        return (
                          <p key={i} className="leading-relaxed whitespace-pre-wrap text-foreground/90">
                            {part.text}
                          </p>
                        );
                      }
                      if (isToolUIPart(part) || isDynamicToolUIPart(part)) {
                        const toolName = isDynamicToolUIPart(part) ? part.toolName : part.type.replace(/^tool-/, "");
                        const meta = TOOL_LABELS[toolName];
                        const Icon = meta?.icon ?? Wand2;
                        const output = (part.state === "output-available" ? part.output : undefined) as ToolOutput;
                        const failed = part.state === "output-error" || output?.ok === false;
                        const done = part.state === "output-available" && !failed;
                        const detail = failed
                          ? (output?.error ?? (part.state === "output-error" ? part.errorText : undefined))
                          : output?.summary;

                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${
                              failed
                                ? "border-amber-500/20 bg-amber-500/5"
                                : "border-white/8 bg-white/3"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${
                                failed ? "bg-amber-500/15 text-amber-400" : "bg-primary/12 text-primary"
                              }`}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-xs font-medium">
                                {done ? meta?.done ?? toolName : failed ? "Couldn't finish" : meta?.running ?? toolName}
                                {done && <Check className="size-3 text-emerald-400" />}
                                {failed && <AlertTriangle className="size-3 text-amber-400" />}
                                {!done && !failed && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                              </p>
                              {detail && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detail}</p>}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )
              )
            )}

            {status === "submitted" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex gap-0.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary/70" />
                </span>
                Thinking…
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-400" />
                {error.message.includes(PROMPT_LIMIT_ERROR) ? (
                  <span>
                    You&apos;re out of agent prompts this month.{" "}
                    <button
                      type="button"
                      onClick={() => openUpgrade(UPGRADE_REASONS.prompts)}
                      className="font-medium text-primary hover:underline"
                    >
                      Upgrade
                    </button>
                  </span>
                ) : (
                  "Something went wrong. Try sending that again."
                )}
              </div>
            )}
          </div>

          <div className="relative shrink-0 p-3">
            <div className="rounded-2xl border border-white/10 bg-background/60 p-2 transition focus-within:border-primary/45 focus-within:ring-4 focus-within:ring-primary/10">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={submitOnEnter(() => send(input))}
                placeholder={isReady ? "Ask the agent…" : "Waiting for the editors…"}
                rows={2}
                disabled={!isReady}
                readOnly={listening}
                className="field-sizing-content max-h-40 min-h-11 w-full resize-none bg-transparent px-1.5 pt-0.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
              <div className="flex items-center justify-between gap-2 pl-1.5">
                <span className="text-[10px] text-muted-foreground/60">Shift + Enter for a new line</span>
                <div className="flex items-center gap-1">
                  <MicButton
                    value={input}
                    onChange={setInput}
                    onListeningChange={setListening}
                    disabled={!isReady || isBusy}
                  />
                  {isBusy ? (
                    <Button size="icon" variant="secondary" onClick={stop} className="size-8 rounded-full" aria-label="Stop">
                      <Square className="size-3 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={() => send(input)}
                      disabled={!input.trim() || !isReady}
                      className="size-8 rounded-full shadow-lg shadow-primary/25"
                      aria-label="Send"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
