import { describe, expect, it } from "vitest";
import { layeredLayout, type LayoutNode } from "./canvas-layout";

const box = (id: string, w = 100, h = 50): LayoutNode => ({ id, w, h });
const vertical = { direction: "vertical" as const, gapMain: 40, gapCross: 20 };
const horizontal = { direction: "horizontal" as const, gapMain: 40, gapCross: 20 };

function overlaps(nodes: LayoutNode[], layout: ReturnType<typeof layeredLayout>) {
  const rects = nodes.map((n) => ({ ...layout.positions.get(n.id)!, w: n.w, h: n.h }));
  return rects.some((a, i) =>
    rects.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
  );
}

describe("layeredLayout", () => {
  it("stacks a chain top to bottom, one layer per node", () => {
    const nodes = [box("a"), box("b"), box("c")];
    const layout = layeredLayout(nodes, [{ from: "a", to: "b" }, { from: "b", to: "c" }], vertical);

    expect(layout.order).toEqual(["a", "b", "c"]);
    expect(layout.positions.get("a")!.y).toBe(0);
    expect(layout.positions.get("b")!.y).toBe(50 + 40);
    expect(layout.positions.get("c")!.y).toBe(2 * (50 + 40));
    expect(layout.height).toBe(3 * 50 + 2 * 40);
    expect(layout.width).toBe(100);
  });

  it("runs left to right when horizontal", () => {
    const nodes = [box("a"), box("b")];
    const layout = layeredLayout(nodes, [{ from: "a", to: "b" }], horizontal);

    expect(layout.positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(layout.positions.get("b")).toEqual({ x: 100 + 40, y: 0 });
    expect(layout.width).toBe(240);
    expect(layout.height).toBe(50);
  });

  it("puts a node one layer past its deepest parent", () => {
    // a → b → c, and a → c directly: c still goes below b.
    const nodes = [box("a"), box("b"), box("c")];
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "a", to: "c" },
    ];
    const layout = layeredLayout(nodes, edges, vertical);
    expect(layout.positions.get("c")!.y).toBeGreaterThan(layout.positions.get("b")!.y);
  });

  it("detects loops as back edges and still terminates", () => {
    const nodes = [box("start"), box("check"), box("retry")];
    const loop = { from: "retry", to: "check" };
    const edges = [{ from: "start", to: "check" }, { from: "check", to: "retry" }, loop];
    const layout = layeredLayout(nodes, edges, vertical);

    expect(layout.backEdges.has(loop)).toBe(true);
    expect(layout.backEdges.size).toBe(1);
    expect(layout.order).toEqual(["start", "check", "retry"]);
  });

  it("ignores self-loops and edges to unknown nodes", () => {
    const nodes = [box("a"), box("b")];
    const layout = layeredLayout(
      nodes,
      [{ from: "a", to: "a" }, { from: "a", to: "ghost" }, { from: "a", to: "b" }],
      vertical
    );
    expect(layout.positions.size).toBe(2);
    expect(layout.positions.get("b")!.y).toBe(90);
  });

  it("wraps a layer wider than maxPerLayer into extra layers", () => {
    const children = ["c1", "c2", "c3", "c4", "c5"];
    const nodes = [box("root"), ...children.map((id) => box(id))];
    const edges = children.map((to) => ({ from: "root", to }));
    const layout = layeredLayout(nodes, edges, { ...vertical, maxPerLayer: 2 });

    const rows = new Set(children.map((id) => layout.positions.get(id)!.y));
    expect(rows.size).toBe(3); // 2 + 2 + 1
  });

  it("never overlaps nodes of different sizes", () => {
    const nodes = [box("a", 300, 80), box("b", 80, 200), box("c", 150, 40), box("d", 220, 120), box("e")];
    const edges = [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
      { from: "a", to: "d" },
      { from: "c", to: "e" },
    ];
    expect(overlaps(nodes, layeredLayout(nodes, edges, vertical))).toBe(false);
    expect(overlaps(nodes, layeredLayout(nodes, edges, horizontal))).toBe(false);
  });

  it("orders a layer to avoid crossings", () => {
    // Two parallel chains given in a crossed order: x1 → y2, x2 → y1.
    const nodes = [box("x1"), box("x2"), box("y1"), box("y2")];
    const edges = [
      { from: "x1", to: "y2" },
      { from: "x2", to: "y1" },
    ];
    const layout = layeredLayout(nodes, edges, vertical);
    const x = (id: string) => layout.positions.get(id)!.x;
    // Each child sits on the same side as its parent.
    expect(Math.sign(x("x1") - x("x2"))).toBe(Math.sign(x("y2") - x("y1")));
  });

  it("handles an empty diagram", () => {
    const layout = layeredLayout([], [], vertical);
    expect(layout.order).toEqual([]);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });
});
