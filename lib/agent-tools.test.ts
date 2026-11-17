import { describe, expect, it } from "vitest";
import {
  createDiagramInput,
  createTablesInput,
  editDocInput,
  editShapesInput,
  updateTableInput,
  writeDocInput,
} from "./agent-tools";

// The model's tool calls are validated against these schemas before anything touches the canvas.

describe("createTablesInput", () => {
  it("accepts a schema and defaults relations to an empty list", () => {
    const input = createTablesInput.parse({
      tables: [{ name: "users", fields: [{ name: "id", type: "uuid", pk: true }] }],
    });
    expect(input.relations).toEqual([]);
  });

  it("rejects a table with no columns", () => {
    expect(createTablesInput.safeParse({ tables: [{ name: "users", fields: [] }] }).success).toBe(false);
  });

  it("rejects an empty schema", () => {
    expect(createTablesInput.safeParse({ tables: [] }).success).toBe(false);
  });
});

describe("createDiagramInput", () => {
  it("fills in defaults for kind, shape and edges", () => {
    const input = createDiagramInput.parse({ nodes: [{ id: "a", label: "Start" }] });
    expect(input.kind).toBe("flowchart");
    expect(input.nodes[0].shape).toBe("rectangle");
    expect(input.edges).toEqual([]);
  });

  it("rejects unknown shapes and colors", () => {
    expect(createDiagramInput.safeParse({ nodes: [{ id: "a", label: "A", shape: "star" }] }).success).toBe(false);
    expect(createDiagramInput.safeParse({ nodes: [{ id: "a", label: "A", color: "pink" }] }).success).toBe(false);
  });

  it("rejects an unknown diagram kind", () => {
    expect(createDiagramInput.safeParse({ kind: "gantt", nodes: [{ id: "a", label: "A" }] }).success).toBe(false);
  });
});

describe("other tool inputs", () => {
  it("writeDocInput requires a mode", () => {
    expect(writeDocInput.safeParse({ markdown: "# Hi" }).success).toBe(false);
    expect(writeDocInput.safeParse({ markdown: "# Hi", mode: "append" }).success).toBe(true);
  });

  it("updateTableInput defaults its column lists", () => {
    const input = updateTableInput.parse({ table: "users" });
    expect(input).toMatchObject({ addColumns: [], updateColumns: [], removeColumns: [] });
  });

  it("editShapesInput defaults to doing nothing", () => {
    expect(editShapesInput.parse({})).toEqual({ delete: [], relabel: [] });
  });

  it("editDocInput needs at least one operation with a known action", () => {
    expect(editDocInput.safeParse({ operations: [] }).success).toBe(false);
    expect(editDocInput.safeParse({ operations: [{ action: "move", blockId: "b1" }] }).success).toBe(false);
  });
});
