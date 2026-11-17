import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Editor, TLArrowBinding } from "tldraw";
import { createTestEditor } from "@/tests/editor";
import { buildAgentContext, runAgentTool, startAgentRun, undoAgentRun } from "@/lib/agent-executors";
import { readErdSchema } from "@/lib/erd-export-editor";
import { toSql } from "@/lib/erd-export";
import { ENTITY_TABLE_TYPE, type EntityTableShape } from "@/components/EntityTable/EntityTableShapeUtil";

// The agent's tools, run against a real (headless) tldraw editor, the same way the chat runs them.

let editor: Editor;
const run = (tool: string, input: unknown) =>
  runAgentTool(tool, input, () => ({ canvasEditor: editor, docEditor: null }));
const tables = () =>
  editor.getCurrentPageShapes().filter((s): s is EntityTableShape => s.type === ENTITY_TABLE_TYPE);

const blogSchema = {
  title: "Blog",
  tables: [
    { name: "users", fields: [{ name: "id", type: "uuid", pk: true }, { name: "email", type: "text" }] },
    {
      name: "posts",
      fields: [
        { name: "id", type: "uuid", pk: true },
        { name: "title", type: "text" },
        { name: "author_id", type: "uuid", fk: true },
      ],
    },
  ],
  relations: [{ fromTable: "posts", fromColumn: "author_id", toTable: "users", toColumn: "id", label: "N:1" }],
};

beforeEach(() => {
  editor = createTestEditor();
});
afterEach(() => editor.dispose());

describe("create_tables", () => {
  it("draws tables in a titled frame with a row-to-row relation", async () => {
    const result = await run("create_tables", blogSchema);
    expect(result).toEqual({ ok: true, summary: "Drew a database schema with 2 table(s) and 1 relation(s)." });

    const frame = editor.getCurrentPageShapes().find((s) => s.type === "frame");
    expect(frame && "name" in frame.props && frame.props.name).toBe("Database schema · Blog");
    expect(tables().map((t) => t.props.name).sort()).toEqual(["posts", "users"]);
    expect(tables().every((t) => t.parentId === frame!.id)).toBe(true);

    // The arrow is bound to the exact columns, by field id.
    const arrow = editor.getCurrentPageShapes().find((s) => s.type === "arrow")!;
    const bindings = editor.getBindingsFromShape<TLArrowBinding>(arrow, "arrow");
    const posts = tables().find((t) => t.props.name === "posts")!;
    const users = tables().find((t) => t.props.name === "users")!;
    const start = bindings.find((b) => b.props.terminal === "start")!;
    const end = bindings.find((b) => b.props.terminal === "end")!;
    expect(start.toId).toBe(posts.id);
    expect(start.meta.fieldId).toBe(posts.props.fields.find((f) => f.name === "author_id")!.id);
    expect(end.toId).toBe(users.id);
    expect(end.meta.fieldId).toBe(users.props.fields.find((f) => f.name === "id")!.id);
  });

  it("skips relations to tables that don't exist, and says so", async () => {
    const result = await run("create_tables", {
      ...blogSchema,
      relations: [{ fromTable: "posts", fromColumn: "author_id", toTable: "authors", toColumn: "id" }],
    });
    expect(result.ok && result.summary).toContain("Skipped relations to unknown tables: posts → authors");
  });

  it("returns a readable error to the model when the input is invalid", async () => {
    const result = await run("create_tables", { tables: [] });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Invalid input for create_tables/);
    expect(editor.getCurrentPageShapeIds().size).toBe(0);
  });
});

describe("update_table", () => {
  it("adds, changes and removes columns, keeping field ids", async () => {
    await run("create_tables", blogSchema);
    const before = tables().find((t) => t.props.name === "posts")!;
    const titleId = before.props.fields.find((f) => f.name === "title")!.id;

    const result = await run("update_table", {
      table: "POSTS",
      addColumns: [{ name: "published_at", type: "timestamp" }],
      updateColumns: [{ column: "title", name: "headline" }],
      removeColumns: [],
    });
    expect(result.ok).toBe(true);

    const after = editor.getShape<EntityTableShape>(before.id)!;
    expect(after.props.fields.map((f) => f.name)).toEqual(["id", "headline", "author_id", "published_at"]);
    expect(after.props.fields[1].id).toBe(titleId);
    expect(after.props.h).toBeGreaterThan(before.props.h);
  });

  it("reports unknown tables and columns", async () => {
    await run("create_tables", blogSchema);
    expect(await run("update_table", { table: "comments" })).toEqual({
      ok: false,
      error: 'No table named "comments" on the canvas.',
    });
    const missing = await run("update_table", { table: "posts", removeColumns: ["body"] });
    expect(!missing.ok && missing.error).toBe("No column(s) body in posts.");
  });
});

describe("create_diagram", () => {
  it("draws nodes and arrows, ignoring edges to unknown nodes", async () => {
    const result = await run("create_diagram", {
      kind: "flowchart",
      title: "Checkout",
      nodes: [
        { id: "start", label: "Start", shape: "ellipse" },
        { id: "pay", label: "Pay" },
        { id: "ok", label: "Paid?", shape: "diamond" },
      ],
      edges: [
        { from: "start", to: "pay" },
        { from: "pay", to: "ok" },
        { from: "ok", to: "pay", label: "No" },
        { from: "ok", to: "ghost" },
      ],
    });
    expect(result).toEqual({ ok: true, summary: 'Drew "Flowchart · Checkout" with 3 node(s) and 3 connection(s).' });
    const shapes = editor.getCurrentPageShapes();
    expect(shapes.filter((s) => s.type === "geo")).toHaveLength(3);
    expect(shapes.filter((s) => s.type === "arrow")).toHaveLength(3);
    // Everything ends fully visible, even though it was created to fade in.
    expect(shapes.every((s) => s.opacity === 1)).toBe(true);
  });
});

describe("edit_shapes and clear_canvas", () => {
  it("deletes by id and reports unknown ids", async () => {
    await run("create_tables", blogSchema);
    const users = tables().find((t) => t.props.name === "users")!;
    const result = await run("edit_shapes", { delete: [users.id, "shape:nope"] });
    expect(result.ok && result.summary).toContain("deleted 1 shape(s)");
    expect(result.ok && result.summary).toContain("shape:nope");
    expect(editor.getShape(users.id)).toBeUndefined();
  });

  it("clears everything", async () => {
    await run("create_tables", blogSchema);
    const result = await run("clear_canvas", {});
    expect(result.ok).toBe(true);
    expect(editor.getCurrentPageShapeIds().size).toBe(0);
  });
});

describe("surfaces that aren't open", () => {
  it("tells the model to ask the user to open the canvas", async () => {
    const result = await runAgentTool("create_tables", blogSchema, () => ({ canvasEditor: null, docEditor: null }));
    expect(!result.ok && result.error).toMatch(/canvas isn't open/);
  });

  it("tells the model to ask the user to open the doc", async () => {
    const result = await run("write_doc", { markdown: "# Hi", mode: "append" });
    expect(!result.ok && result.error).toMatch(/doc isn't open/);
  });
});

describe("buildAgentContext", () => {
  it("lists tables with their columns and the relation between them", async () => {
    await run("create_tables", blogSchema);
    const context = buildAgentContext({ canvasEditor: editor, docEditor: null });
    expect(context.canvasOpen).toBe(true);
    expect(context.docOpen).toBe(false);
    expect(context.canvas).toContain("table posts (id uuid PK, title text, author_id uuid FK)");
    expect(context.canvas).toContain('arrow posts → users "N:1"');
  });
});

describe("undoAgentRun", () => {
  it("undoes every tool of a run in one step, and can be redone", async () => {
    await run("create_diagram", { nodes: [{ id: "keep", label: "Drawn before" }] });
    const before = editor.getCurrentPageShapeIds().size;

    const mark = startAgentRun(editor);
    expect(await run("create_tables", blogSchema)).toMatchObject({ ok: true });
    await run("update_table", { table: "posts", addColumns: [{ name: "slug", type: "text" }] });
    expect(editor.getCurrentPageShapeIds().size).toBeGreaterThan(before);

    expect(undoAgentRun(editor, mark)).toBe(true);
    expect(editor.getCurrentPageShapeIds().size).toBe(before);
    expect(tables()).toHaveLength(0);

    editor.redo();
    expect(tables().find((t) => t.props.name === "posts")?.props.fields.map((f) => f.name)).toContain("slug");
  });
});

describe("ERD export from the canvas", () => {
  it("reads back what the agent drew and exports it as SQL", async () => {
    await run("create_tables", blogSchema);
    const schema = readErdSchema(editor);
    expect(schema.relations).toEqual([
      { fromTable: "posts", fromColumn: "author_id", toTable: "users", toColumn: "id" },
    ]);
    expect(toSql(schema)).toContain("FOREIGN KEY (author_id) REFERENCES users (id)");
  });

  it("keeps the relation on its column after columns are reordered", async () => {
    await run("create_tables", blogSchema);
    // Rename and add columns: the arrow follows author_id by field id, not by row position.
    await run("update_table", { table: "posts", updateColumns: [{ column: "author_id", name: "writer_id" }] });
    expect(readErdSchema(editor).relations[0]).toMatchObject({ fromColumn: "writer_id" });
  });
});
