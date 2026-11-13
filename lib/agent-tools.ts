import { tool } from "ai";
import { z } from "zod";

// The agent's tools. None has an execute function: the model only decides what to draw or
// write, and the browser carries it out on the live editors (lib/agent-executors.ts, called from
// hooks/use-workspace-agent-chat), so changes go through the same sync/autosave paths as a
// person's edits.

export const DIAGRAM_COLORS = ["blue", "light-blue", "violet", "light-violet", "green", "light-green", "orange", "yellow", "red", "light-red", "grey", "black"] as const;

// What a diagram is, shown in its frame's title on the canvas ("Flowchart · Checkout").
export const DIAGRAM_KINDS = {
  flowchart: "Flowchart",
  user_flow: "User flow",
  process: "Process diagram",
  architecture: "Architecture diagram",
  mind_map: "Mind map",
  org_chart: "Org chart",
  other: "Diagram",
} as const;
export type DiagramKind = keyof typeof DIAGRAM_KINDS;
const diagramKinds = Object.keys(DIAGRAM_KINDS) as [DiagramKind, ...DiagramKind[]];

export const createTablesInput = z.object({
  title: z.string().optional().describe("short name for the schema, e.g. Blog or Food delivery"),
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
  kind: z.enum(diagramKinds).optional().default("flowchart").describe("what this diagram is; shown in its title"),
  title: z.string().optional().describe("short name, e.g. Checkout or User onboarding"),
  nodes: z
    .array(
      z.object({
        id: z.string().describe("short unique id used by edges"),
        label: z.string().describe("short: two to five words"),
        shape: z
          .enum(["rectangle", "ellipse", "diamond", "cloud", "hexagon"])
          .optional()
          .default("rectangle")
          .describe("ellipse for start/end, diamond for decisions, rectangle for steps"),
        color: z.enum(DIAGRAM_COLORS).optional(),
      })
    )
    .min(1),
  edges: z
    .array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() }))
    .optional()
    .default([]),
  direction: z
    .enum(["horizontal", "vertical"])
    .optional()
    .describe("defaults to vertical (top-down) for flowcharts and flows, horizontal for architecture"),
});

export const writeDocInput = z.object({
  markdown: z.string().describe("GitHub-flavored markdown: headings, lists, tables, code blocks"),
  mode: z.enum(["replace", "append"]).describe("replace rewrites the whole doc; append adds to the end"),
});

const columnInput = z.object({
  name: z.string().describe("snake_case column name"),
  type: z.string().describe("SQL-ish type, e.g. uuid, text, int, timestamp, boolean"),
  pk: z.boolean().optional().describe("primary key"),
  fk: z.boolean().optional().describe("foreign key"),
});

export const updateTableInput = z.object({
  table: z.string().describe("name of an existing table on the canvas"),
  rename: z.string().optional().describe("new table name"),
  addColumns: z.array(columnInput).optional().default([]),
  updateColumns: z
    .array(
      z.object({
        column: z.string().describe("current name of the column to change"),
        name: z.string().optional(),
        type: z.string().optional(),
        pk: z.boolean().optional(),
        fk: z.boolean().optional(),
      })
    )
    .optional()
    .default([]),
  removeColumns: z.array(z.string()).optional().default([]).describe("names of columns to remove"),
});

export const editShapesInput = z.object({
  delete: z.array(z.string()).optional().default([]).describe("ids of shapes to delete, e.g. shape:abc123"),
  relabel: z
    .array(z.object({ shapeId: z.string(), text: z.string() }))
    .optional()
    .default([])
    .describe("change the text of existing shapes or arrows"),
});

export const editDocInput = z.object({
  operations: z
    .array(
      z.object({
        action: z
          .enum(["replace", "delete", "insert_after"])
          .describe("replace a block with new markdown, delete it, or insert markdown after it"),
        blockId: z.string().describe("id of an existing block, from the doc listing"),
        markdown: z.string().optional().describe("required for replace and insert_after"),
      })
    )
    .min(1),
});

export const clearCanvasInput = z.object({});

export const agentTools = {
  create_tables: tool({
    description:
      "Draw a database schema (ERD) on the canvas, with relationship arrows from a foreign key column to the column it references. It appears step by step in a frame titled \"Database schema · <title>\", beside existing content.",
    inputSchema: createTablesInput,
  }),
  create_diagram: tool({
    description:
      "Draw a flowchart, user flow, architecture or process diagram on the canvas: labeled nodes connected by arrows, laid out automatically and drawn step by step in a frame titled by its kind and title.",
    inputSchema: createDiagramInput,
  }),
  update_table: tool({
    description:
      "Change an existing ERD table: rename it, or add, change or remove columns. Relationship arrows stay on their columns.",
    inputSchema: updateTableInput,
  }),
  edit_shapes: tool({
    description: "Delete shapes or change their text, by the shape ids listed in the current canvas.",
    inputSchema: editShapesInput,
  }),
  write_doc: tool({
    description: "Write to the workspace document, in markdown.",
    inputSchema: writeDocInput,
  }),
  edit_doc: tool({
    description:
      "Edit specific parts of the document by block id: replace a block, delete it, or insert after it. Use this instead of rewriting the whole doc for small changes.",
    inputSchema: editDocInput,
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
