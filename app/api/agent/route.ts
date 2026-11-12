import { auth } from "@clerk/nextjs/server";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { checkUser } from "@/actions/check-user";
import { canAccessWorkspace } from "@/lib/workspace-access";
import {
  hasRecentPrompt,
  refundPrompt,
  reservePrompt,
  workspaceOwnerId,
  workspaceOwnerSelect,
} from "@/lib/billing";
import { PROMPT_LIMIT_ERROR } from "@/lib/plan-limits";
import { agentTools, type AgentContext } from "@/lib/agent-tools";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const MODEL = process.env.AGENT_MODEL ?? "gemini-3.8-flash";

// The client already trims its canvas/doc listings; this caps what a hand-made request can send.
const MAX_CONTEXT_CHARS = 20_000;

function instructionsFor(workspace: { name: string; description: string | null }, context: AgentContext) {
  return `You are Outpost Agent, a collaborator inside a workspace that pairs a document with a canvas (whiteboard).
Workspace: "${workspace.name}"${workspace.description ? ` — ${workspace.description}` : ""}

You change the workspace only through tools:
- create_tables: database/ERD tables and foreign-key relations on the canvas.
- create_diagram: flowcharts, architectures, user flows and processes on the canvas.
- update_table: rename an existing table or add, change or remove its columns.
- edit_shapes: delete shapes or change their text, by the [shape:…] ids in the canvas listing.
- write_doc: the document, in markdown. Prefer "append" unless rewriting is clearly wanted.
- edit_doc: targeted doc changes by the [block id] in the doc listing; use it for small fixes instead of rewriting.
- clear_canvas: only when asked to start over.

Guidelines:
- By default do both: draw on the canvas and document it in the doc. If the user says "in the doc" or "on the canvas", keep to that surface.
- Don't redraw what is already on the canvas; add to it or edit it. Refer to existing tables by name in relations.
- Ids in square brackets in the listings below are for tools only; never show them to the user.
- Docs should be well structured: a title, short intro, sections with headings, lists and tables where useful.
- After the tools run, reply with one or two short sentences about what you did. No markdown in chat replies.
- If a tool says a surface isn't open, tell the user which view to switch to.

Current canvas${context.canvasOpen ? "" : " (not open in this view)"}:
${context.canvasOpen ? context.canvas : "unavailable"}

Current doc${context.docOpen ? "" : " (not open in this view)"}:
${context.docOpen ? context.doc : "unavailable"}`;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: { messages?: unknown; workspaceId?: unknown; context?: Partial<AgentContext> };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
  const { messages, workspaceId, context } = body;
  if (typeof workspaceId !== "string" || !workspaceId) {
    return new Response("Workspace not found", { status: 404 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Invalid request", { status: 400 });
  }

  // Independent lookups, run together.
  const [allowed, user, workspace] = await Promise.all([
    canAccessWorkspace(workspaceId),
    checkUser(),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, description: true, ...workspaceOwnerSelect },
    }),
  ]);
  if (!allowed || !workspace) return new Response("Workspace not found", { status: 404 });
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Only a new user message counts as a prompt; the automatic follow-ups that carry tool
  // results back to the model are part of the same prompt.
  let promptId: string | null = null;
  if ((messages as UIMessage[]).at(-1)?.role === "user") {
    promptId = await reservePrompt(workspaceOwnerId(workspace), user.id, workspaceId);
    if (!promptId) return new Response(PROMPT_LIMIT_ERROR, { status: 402 });
  } else if (!(await hasRecentPrompt(user.id, workspaceId))) {
    return new Response(PROMPT_LIMIT_ERROR, { status: 402 });
  }

  // A failed response (e.g. the model is overloaded, or the messages couldn't be read) doesn't
  // cost the user a prompt. Refunded at most once, however many ways it fails.
  let refunded = false;
  const refund = async () => {
    if (!promptId || refunded) return;
    refunded = true;
    await refundPrompt(promptId).catch((error) => console.error("[agent] refund failed", error));
  };

  try {
    const result = streamText({
      model: google(MODEL),
      instructions: instructionsFor(workspace, {
        canvasOpen: !!context?.canvasOpen,
        docOpen: !!context?.docOpen,
        canvas: String(context?.canvas ?? "").slice(0, MAX_CONTEXT_CHARS),
        doc: String(context?.doc ?? "").slice(0, MAX_CONTEXT_CHARS),
      }),
      messages: await convertToModelMessages(messages as UIMessage[], {
        tools: agentTools,
        ignoreIncompleteToolCalls: true,
      }),
      tools: agentTools,
      stopWhen: stepCountIs(5),
      providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
      onError: async ({ error }) => {
        console.error("[agent]", error);
        await refund();
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
  } catch (error) {
    console.error("[agent]", error);
    await refund();
    return new Response("The agent couldn't start", { status: 500 });
  }
}
