"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { Editor } from "tldraw";
import type { DocEditor } from "@/components/WorkspaceEditorsContext";
import { buildAgentContext, runAgentTool } from "@/lib/agent-executors";
import { refreshPromptUsage } from "@/components/PlanButton";

type Editors = { canvasEditor: Editor | null; docEditor: DocEditor | null };

// The workspace agent's chat. Every request carries a snapshot of the canvas and doc so the
// model sees what's there now; its tool calls run here, on the live editors, and the chat
// resubmits automatically once every tool call in a step has its result.
export function useWorkspaceAgentChat(workspaceId: string, editors: Editors) {
  // The transport and tool handler are created once, so they read the editors through a ref.
  const editorsRef = useRef(editors);
  useEffect(() => {
    editorsRef.current = editors;
  });

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
      // Drawing runs step by step, so the result comes later. Not awaited, per the SDK: awaiting
      // inside onToolCall can deadlock the chat. The chat resubmits once every output is in.
      void runAgentTool(toolCall.toolName, toolCall.input, editorsRef.current).then((output) =>
        chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output })
      );
    },
  });

  return chat;
}

export type WorkspaceAgentChat = ReturnType<typeof useWorkspaceAgentChat>;
