import { tool } from "ai";
import { z } from "zod";

// The agent's tools. None has an execute function: the model only decides what to draw or
// write, and the browser carries it out on the live editors (see hooks/use-workspace-agent-chat),
// so changes go through the same sync/autosave paths as a person's edits.

export const DIAGRAM_COLORS = ["blue", "light-blue", "violet", "light-violet", "green", "light-green", "orange", "yellow", "red", "light-red", "grey", "black"] as const;

export const createTablesInput = z.object({
  tables: z
    .array(
      z.object({
        name: z.string().describe("snake_case table name, e.g. users"),
        fields: z
          .array(
            z.object({
              name: z.string().describe("snake_case column name"),
              type: z.string().describe("SQL-ish type, e.g. uuid, text, int, timestamp, boolean"),
              pk: z.boolean().optional().describe("primary key"),
              fk: z.boolean().optional().describe("foreign key"),
            })
          )
          .min(1),
      })
    )
    .min(1),
  relations: z
    .array(
      z.object({
        fromTable: z.string(),
        fromColumn: z.string().describe("usually the foreign key column"),
        toTable: z.string(),
        toColumn: z.string().describe("usually the referenced primary key"),
        label: z.string().optional().describe("e.g. 1:N"),
      })
    )
    .optional()
    .default([]),
});

export const createDiagramInput = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().describe("short unique id used by edges"),
        label: z.string(),
        shape: z.enum(["rectangle", "ellipse", "diamond", "cloud", "hexagon"]).optional().default("rectangle"),
        color: z.enum(DIAGRAM_COLORS).optional(),
      })
    )
    .min(1),
  edges: z
    .array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() }))
    .optional()
    .default([]),
  direction: z.enum(["horizontal", "vertical"]).optional().default("horizontal"),
});

export const writeDocInput = z.object({
  markdown: z.string().describe("GitHub-flavored markdown: headings, lists, tables, code blocks"),
  mode: z.enum(["replace", "append"]).describe("replace rewrites the whole doc; append adds to the end"),
});

export const clearCanvasInput = z.object({});

export const agentTools = {
  create_tables: tool({
    description:
      "Draw database tables (ERD) on the canvas, with relationship arrows from a foreign key column to the column it references. New tables are placed beside existing content.",
    inputSchema: createTablesInput,
  }),
  create_diagram: tool({
    description:
      "Draw a flowchart, architecture or process diagram on the canvas: labeled nodes connected by arrows, laid out automatically.",
    inputSchema: createDiagramInput,
  }),
  write_doc: tool({
    description: "Write to the workspace document, in markdown.",
    inputSchema: writeDocInput,
  }),
  clear_canvas: tool({
    description: "Delete everything on the canvas. Only when the user asks to start over or clear it.",
    inputSchema: clearCanvasInput,
  }),
};

export type AgentToolName = keyof typeof agentTools;

// What the client sends with every request so the model sees the current state of both surfaces.
export type AgentContext = {
  canvasOpen: boolean;
  docOpen: boolean;
  canvas: string;
  doc: string;
};
