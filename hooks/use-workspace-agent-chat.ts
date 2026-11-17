"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { Editor } from "tldraw";
import type { DocEditor } from "@/components/WorkspaceEditorsContext";
import { buildAgentContext, runAgentTool, startAgentRun, undoAgentRun } from "@/lib/agent-executors";
import { refreshPromptUsage } from "@/components/PlanButton";

type Editors = { canvasEditor: Editor | null; docEditor: DocEditor | null; canvasVisible: boolean };

const CANVAS_TOOLS = new Set(["create_tables", "create_diagram", "update_table", "edit_shapes", "clear_canvas"]);

// The canvas history mark a prompt started from, so everything it drew can be undone in one step.
type Run = { editor: Editor; markId: string };

// The workspace agent's chat. Every request carries a snapshot of the canvas and doc so the
// model sees what's there now; its tool calls run here, on the live editors, and the chat
// resubmits automatically once every tool call in a step has its result.
export function useWorkspaceAgentChat(workspaceId: string, editors: Editors) {
  // The transport and tool handler are created once, so they read the editors through a ref.
  const editorsRef = useRef(editors);
  useEffect(() => {
    editorsRef.current = editors;
  });

  // The ref is what callbacks check; the state is what renders.
  const runRef = useRef<Run | null>(null);
  const [run, setRunState] = useState<Run | null>(null);
  const setRun = (next: Run | null) => {
    runRef.current = next;
    setRunState(next);
  };
  // Canvas tools of the current prompt still drawing, whether any changed the canvas, and whether
  // someone has edited the canvas since (then undoing the run would undo their edits too).
  const [pendingCanvasTools, setPendingCanvasTools] = useState(0);
  const [runChangedCanvas, setRunChangedCanvas] = useState(false);
  const [editedSinceRun, setEditedSinceRun] = useState(false);

  const [transport] = useState(
    // The ref is read when a request is sent, never during render.
    // eslint-disable-next-line react-hooks/refs
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, messages, workspaceId, context: buildAgentContext(editorsRef.current) },
        }),
      })
  );

  const chat = useChat({
    id: `workspace-${workspaceId}`,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Keep the header's prompt count current: a prompt was used, or refunded after a failure.
    onFinish: () => refreshPromptUsage(),
    onError: () => refreshPromptUsage(),
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;
      const onCanvas = CANVAS_TOOLS.has(toolCall.toolName);
      if (onCanvas) {
        setPendingCanvasTools((n) => n + 1);
        // The canvas may still have been connecting when the prompt was sent.
        const editor = editorsRef.current.canvasEditor;
        if (!runRef.current && editor) setRun({ editor, markId: startAgentRun(editor) });
      }
      // Drawing runs step by step, so the result comes later. Not awaited, per the SDK: awaiting
      // inside onToolCall can deadlock the chat. The chat resubmits once every output is in.
      void runAgentTool(toolCall.toolName, toolCall.input, () => editorsRef.current).then((output) => {
        if (onCanvas) {
          setPendingCanvasTools((n) => n - 1);
          if (output.ok) setRunChangedCanvas(true);
        }
        chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
      });
    },
  });

  const runFinished = chat.status === "ready" && pendingCanvasTools === 0;
  const canUndoRun = runFinished && runChangedCanvas && !editedSinceRun && !!run && !run.editor.isDisposed;

  // Once the run is over, the first edit to the canvas (by anyone on this device) retires the undo.
  useEffect(() => {
    if (!canUndoRun || !run) return;
    return run.editor.store.listen(() => setEditedSinceRun(true), { source: "user", scope: "document" });
  }, [canUndoRun, run]);

  const sendMessage: typeof chat.sendMessage = (...args) => {
    const editor = editorsRef.current.canvasEditor;
    setRun(editor && !editor.isDisposed ? { editor, markId: startAgentRun(editor) } : null);
    setRunChangedCanvas(false);
    setEditedSinceRun(false);
    return chat.sendMessage(...args);
  };

  const undoRun = () => {
    if (!canUndoRun || !run) return;
    undoAgentRun(run.editor, run.markId);
    setRun(null);
    setRunChangedCanvas(false);
  };

  return { ...chat, sendMessage, canUndoRun, undoRun };
}

export type WorkspaceAgentChat = ReturnType<typeof useWorkspaceAgentChat>;
