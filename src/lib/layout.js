export const NODE_W = 168;
export const NODE_H = 60;
const GAP_X = 24;
const GAP_Y = 64;

// Simplified tidy-tree: leaves are placed left-to-right in order, parents are
// centered above their children. Good enough for typical WBS-sized trees.
export function computeTreeLayout(blocks) {
  const nodes = [];
  const edges = [];
  let nextX = 0;

  function place(block, depth, parentId) {
    if (parentId) edges.push({ id: parentId + '->' + block.id, fromId: parentId, toId: block.id });
    let x;
    if (!block.children || block.children.length === 0) {
      x = nextX * (NODE_W + GAP_X);
      nextX += 1;
    } else {
      const childXs = block.children.map((c) => place(c, depth + 1, block.id));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    }
    nodes.push({
      id: block.id,
      text: block.text,
      depth,
      x,
      y: depth * (NODE_H + GAP_Y),
      stageId: block.stageId,
      deadline: block.deadline,
    });
    return x;
  }

  blocks.forEach((b) => place(b, 0, null));
  const maxX = nodes.length ? Math.max(...nodes.map((n) => n.x)) : 0;
  const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y)) : 0;
  return { nodes, edges, nodeW: NODE_W, nodeH: NODE_H, width: maxX + NODE_W, height: maxY + NODE_H };
}

// Flattens a block tree into a flat node list (used by the Network view, which
// ignores parent/child nesting and only cares about manual dependency links).
export function flattenBlocks(blocks) {
  const flat = [];
  function walk(list) {
    list.forEach((b) => {
      flat.push(b);
      walk(b.children || []);
    });
  }
  walk(blocks);
  return flat;
}

// Layered left-to-right DAG layout from manual predecessor -> successor links.
// No timing calculation here on purpose (network view is a fill-in-yourself
// template) -- this only decides node positions so links have something to be
// drawn between.
export function computeNetworkLayout(flatNodes, links) {
  const incoming = new Map(flatNodes.map((n) => [n.id, []]));
  links.forEach((l) => {
    if (incoming.has(l.toId)) incoming.get(l.toId).push(l.fromId);
  });

  const layer = new Map();
  function computeLayer(id, seen) {
    if (layer.has(id)) return layer.get(id);
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const preds = (incoming.get(id) || []).filter((p) => incoming.has(p));
    const l = preds.length ? 1 + Math.max(...preds.map((p) => computeLayer(p, seen))) : 0;
    layer.set(id, l);
    return l;
  }
  flatNodes.forEach((n) => computeLayer(n.id, new Set()));

  const byLayer = new Map();
  flatNodes.forEach((n) => {
    const l = layer.get(n.id) || 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(n);
  });

  const nodeW = 190;
  const nodeH = 96;
  const gapX = 60;
  const gapY = 30;
  const nodes = [];
  Array.from(byLayer.keys())
    .sort((a, b) => a - b)
    .forEach((l) => {
      byLayer.get(l).forEach((n, idx) => {
        nodes.push({ ...n, x: l * (nodeW + gapX), y: idx * (nodeH + gapY) });
      });
    });

  const maxX = nodes.length ? Math.max(...nodes.map((n) => n.x)) : 0;
  const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y)) : 0;
  return { nodes, edges: links, nodeW, nodeH, width: maxX + nodeW, height: maxY + nodeH };
}
