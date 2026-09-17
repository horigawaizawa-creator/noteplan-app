// All functions here are pure / immutable: they return a NEW blocks array
// rather than mutating the one passed in, so React can detect changes.

export function findBlockById(blocks, id) {
  for (const b of blocks) {
    if (b.id === id) return b;
    const found = findBlockById(b.children, id);
    if (found) return found;
  }
  return null;
}

export function blockHasChildren(blocks, id) {
  const b = findBlockById(blocks, id);
  return !!(b && b.children.length > 0);
}

export function updateBlockInTree(blocks, id, patch) {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch };
    if (b.children.length) return { ...b, children: updateBlockInTree(b.children, id, patch) };
    return b;
  });
}

export function deleteBlockFromTree(blocks, id) {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => (b.children.length ? { ...b, children: deleteBlockFromTree(b.children, id) } : b));
}

export function addChildToBlock(blocks, parentId, newBlock) {
  return blocks.map((b) => {
    if (b.id === parentId) return { ...b, children: [...b.children, newBlock] };
    if (b.children.length) return { ...b, children: addChildToBlock(b.children, parentId, newBlock) };
    return b;
  });
}

export function addSiblingAfter(blocks, siblingId, newBlock) {
  const idx = blocks.findIndex((b) => b.id === siblingId);
  if (idx !== -1) {
    const copy = blocks.slice();
    copy.splice(idx + 1, 0, newBlock);
    return copy;
  }
  return blocks.map((b) =>
    b.children.length ? { ...b, children: addSiblingAfter(b.children, siblingId, newBlock) } : b
  );
}

// Moves a block one position earlier/later among its siblings (same tree level).
// direction: -1 = up, +1 = down. No-op (returns the same array reference) if the
// block is already at that edge of its sibling list -- used as a touch/keyboard
// friendly alternative to drag-and-drop, which never fires on mobile browsers.
export function moveSiblingInTree(blocks, id, direction) {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= blocks.length) return blocks;
    const copy = blocks.slice();
    const tmp = copy[idx];
    copy[idx] = copy[swapIdx];
    copy[swapIdx] = tmp;
    return copy;
  }
  // Recurse, but only rebuild a branch if something inside it actually
  // changed -- otherwise hand back the original array/object references so
  // a boundary no-op deep in the tree doesn't fan out into a change at
  // every ancestor level (which would needlessly bump the doc's updatedAt).
  let changed = false;
  const next = blocks.map((b) => {
    if (!b.children.length) return b;
    const children = moveSiblingInTree(b.children, id, direction);
    if (children === b.children) return b;
    changed = true;
    return { ...b, children };
  });
  return changed ? next : blocks;
}
