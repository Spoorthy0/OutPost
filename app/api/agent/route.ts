import { auth } from "@clerk/nextjs/server";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { checkUser } from "@/actions/check-user";
import { canAccessWorkspace } from "@/lib/workspace-access";
import { getPromptUsage, getWorkspaceOwnerId, recordPrompt } from "@/lib/billing";
import { PROMPT_LIMIT_ERROR } from "@/lib/plan-limits";
import { agentTools, type AgentContext } from "@/lib/agent-tools";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const MODEL = process.env.AGENT_MODEL ?? "gemini-2.5-flash";

function instructionsFor(workspace: { name: string; description: string | null }, context: AgentContext) {
  return `You are Outpost Agent, a collaborator inside a workspace that pairs a document with a canvas (whiteboard).
Workspace: "${workspace.name}"${workspace.description ? ` — ${workspace.description}` : ""}

You change the workspace only through tools:
- create_tables: database/ERD tables and foreign-key relations on the canvas.
- create_diagram: flowcharts, architectures, user flows and processes on the canvas.
- write_doc: the document, in markdown. Prefer "append" unless rewriting is clearly wanted.
- clear_canvas: only when asked to start over.

Guidelines:
- By default do both: draw on the canvas and document it in the doc. If the user says "in the doc" or "on the canvas", keep to that surface.
- Don't redraw what is already on the canvas; add to it. Refer to existing tables by name in relations.
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

  const { messages, workspaceId, context } = (await req.json()) as {
    messages: UIMessage[];
    workspaceId: string;
    context: AgentContext;
  };
  if (!workspaceId || !Array.isArray(messages) || !(await canAccessWorkspace(workspaceId))) {
    return new Response("Workspace not found", { status: 404 });
  }

  const user = await checkUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Only a new user message counts as a prompt; the automatic follow-ups that carry tool
  // results back to the model are part of the same prompt.
  if (messages.at(-1)?.role === "user") {
    const ownerId = await getWorkspaceOwnerId(workspaceId);
    const { used, limit } = await getPromptUsage(ownerId);
    if (used >= limit) return new Response(PROMPT_LIMIT_ERROR, { status: 402 });
    await recordPrompt(ownerId, user.id, workspaceId);
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true, description: true },
  });

  const result = streamText({
    model: google(MODEL),
    instructions: instructionsFor(workspace, {
      canvasOpen: !!context?.canvasOpen,
      docOpen: !!context?.docOpen,
      canvas: String(context?.canvas ?? ""),
      doc: String(context?.doc ?? ""),
    }),
    messages: await convertToModelMessages(messages, { tools: agentTools, ignoreIncompleteToolCalls: true }),
    tools: agentTools,
    stopWhen: stepCountIs(5),
    providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
