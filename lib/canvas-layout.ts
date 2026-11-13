// Layered ("Sugiyama-style") layout for the agent's diagrams and ERDs. Pure geometry, no tldraw:
// it takes node sizes and edges and returns where each node's top-left corner goes, relative to
// (0, 0), plus the overall size. Sizes are respected, so nodes never overlap and the gaps between
// them stay even however big the shapes are.

export type LayoutNode = { id: string; w: number; h: number };
export type LayoutEdge = { from: string; to: string };

export type LayoutOptions = {
  // horizontal: layers are columns, flowing left to right. vertical: layers are rows, top to bottom.
  direction: "horizontal" | "vertical";
  // Space between layers (where the arrows run) and between nodes within a layer.
  gapMain: number;
  gapCross: number;
  // A layer with more nodes than this wraps into extra layers, so it doesn't become a long strip.
  maxPerLayer?: number;
};

export type Layout = {
  positions: Map<string, { x: number; y: number }>;
  // Nodes in drawing order: layer by layer, in their final order within each layer.
  order: string[];
  // Edges that loop back against the flow; draw them around the side rather than through the middle.
  backEdges: Set<LayoutEdge>;
  width: number;
  height: number;
};

const ORDERING_SWEEPS = 4;

export function layeredLayout(nodes: LayoutNode[], edges: LayoutEdge[], options: LayoutOptions): Layout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const valid = edges.filter((e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);

  // 1. Loops ("No → try again") would push their nodes down forever, so back edges, those that
  //    return to a node still on the depth-first path, are left out of the layout. They're still
  //    drawn; they just don't decide where anything goes.
  const outgoing = new Map(nodes.map((node) => [node.id, [] as LayoutEdge[]]));
  for (const edge of valid) outgoing.get(edge.from)!.push(edge);
  const state = new Map<string, "active" | "done">();
  const backEdges = new Set<LayoutEdge>();
  const visit = (id: string) => {
    state.set(id, "active");
    for (const edge of outgoing.get(id)!) {
      const next = state.get(edge.to);
      if (next === "active") backEdges.add(edge);
      else if (!next) visit(edge.to);
    }
    state.set(id, "done");
  };
  for (const node of nodes) if (!state.has(node.id)) visit(node.id);
  const forward = valid.filter((edge) => !backEdges.has(edge));

  // 2. Layers: each node sits one layer past its deepest parent.
  const level = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of forward) {
      const next = level.get(edge.from)! + 1;
      if (next > level.get(edge.to)! && next < nodes.length) {
        level.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  let layers: string[][] = [];
  for (const node of nodes) (layers[level.get(node.id)!] ??= []).push(node.id);
  layers = layers.filter(Boolean);

  // 3. Order within layers by the barycenter heuristic: each node moves toward the average position
  //    of its neighbors, sweeping down then up a few times. This removes most arrow crossings.
  const preds = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const succs = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of forward) {
    succs.get(edge.from)!.push(edge.to);
    preds.get(edge.to)!.push(edge.from);
  }
  const indexOf = new Map<string, number>();
  const reindex = (layer: string[]) => layer.forEach((id, index) => indexOf.set(id, index));
  layers.forEach(reindex);

  const reorder = (layer: string[], neighbors: Map<string, string[]>) => {
    const score = new Map(
      layer.map((id, index) => {
        const placed = neighbors.get(id)!.filter((n) => indexOf.has(n));
        const average = placed.length ? placed.reduce((sum, n) => sum + indexOf.get(n)!, 0) / placed.length : index;
        return [id, average];
      })
    );
    layer.sort((a, b) => score.get(a)! - score.get(b)!);
    reindex(layer);
  };
  for (let sweep = 0; sweep < ORDERING_SWEEPS; sweep++) {
    for (let i = 1; i < layers.length; i++) reorder(layers[i], preds);
    for (let i = layers.length - 2; i >= 0; i--) reorder(layers[i], succs);
  }

  // 4. Wrap overly long layers.
  const max = options.maxPerLayer;
  if (max && max > 0) {
    layers = layers.flatMap((layer) =>
      Array.from({ length: Math.ceil(layer.length / max) }, (_, i) => layer.slice(i * max, i * max + max))
    );
  }

  // 5. Place. Every node is centered on its layer's center line, and every layer is centered on
  //    the widest one, so the diagram reads as tidy rows or columns.
  const horizontal = options.direction === "horizontal";
  const mainSize = (id: string) => (horizontal ? byId.get(id)!.w : byId.get(id)!.h);
  const crossSize = (id: string) => (horizontal ? byId.get(id)!.h : byId.get(id)!.w);

  const layerMain = layers.map((layer) => Math.max(...layer.map(mainSize)));
  const layerCross = layers.map(
    (layer) => layer.reduce((sum, id) => sum + crossSize(id), 0) + options.gapCross * (layer.length - 1)
  );
  const maxCross = Math.max(0, ...layerCross);

  const positions = new Map<string, { x: number; y: number }>();
  let mainPos = 0;
  layers.forEach((layer, i) => {
    let cross = (maxCross - layerCross[i]) / 2;
    for (const id of layer) {
      const main = mainPos + (layerMain[i] - mainSize(id)) / 2;
      positions.set(id, horizontal ? { x: main, y: cross } : { x: cross, y: main });
      cross += crossSize(id) + options.gapCross;
    }
    mainPos += layerMain[i] + options.gapMain;
  });
  const totalMain = Math.max(0, mainPos - options.gapMain);

  return {
    positions,
    order: layers.flat(),
    backEdges,
    width: horizontal ? totalMain : maxCross,
    height: horizontal ? maxCross : totalMain,
  };
}
