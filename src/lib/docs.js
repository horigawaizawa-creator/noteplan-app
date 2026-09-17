export function sortDocs(docs) {
  return [...docs].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export function childrenOf(documents, parentId) {
  return sortDocs(Object.values(documents).filter((d) => d.parentId === parentId));
}

export function topLevelByType(documents, type) {
  return sortDocs(Object.values(documents).filter((d) => d.type === type && !d.parentId));
}

export function normalizeSearchQuery(query) {
  return String(query || '').trim().toLocaleLowerCase('uk');
}

export function titleMatchesQuery(doc, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const title = (doc && doc.title ? doc.title : 'Без назви').toLocaleLowerCase('uk');
  return title.includes(q);
}

// A document stays visible in a title search if its own name matches, or if
// any nested child (inside a project) matches -- so you can still find a note
// that lives inside a project without flattening the tree.
export function docOrDescendantMatches(documents, docId, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const doc = documents[docId];
  if (!doc) return false;
  if (titleMatchesQuery(doc, query)) return true;
  if (doc.type !== 'project') return false;
  return childrenOf(documents, docId).some((child) => docOrDescendantMatches(documents, child.id, query));
}

// Given a document and a direction (-1 up, +1 down), returns the [firstId,
// secondId] pair whose `order` should be swapped to move it one step within
// its current visible sibling group (children of the same project, or the
// same top-level type section) -- or null if it's already at that edge.
// Pulled out as its own pure function so the up/down move logic (the
// touch-friendly alternative to sidebar drag-and-drop) is independently
// testable without rendering the app.
export function siblingSwapIds(documents, docId, direction) {
  const doc = documents[docId];
  if (!doc) return null;
  const siblings = doc.parentId ? childrenOf(documents, doc.parentId) : topLevelByType(documents, doc.type);
  const idx = siblings.findIndex((d) => d.id === docId);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return null;
  return [siblings[idx].id, siblings[swapIdx].id];
}

// Projects a document could be moved into via the "..." menu: any other
// project, excluding the document's current parent (already there) and
// excluding anything inside the document's own subtree (which would create
// a cycle -- e.g. moving a project into one of its own child projects).
export function validMoveTargets(documents, docId) {
  const doc = documents[docId];
  if (!doc) return [];
  return Object.values(documents)
    .filter(
      (d) => d.type === 'project' && d.id !== docId && d.id !== doc.parentId && !isDescendantOf(documents, d.id, docId)
    )
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk'));
}

export function nextOrder(documents, parentId) {
  const siblings = Object.values(documents).filter((d) => d.parentId === parentId);
  if (!siblings.length) return 0;
  return Math.max(...siblings.map((d) => d.order ?? 0)) + 1;
}

export function generateUniqueTitle(documents, base, type) {
  const existing = new Set(
    Object.values(documents)
      .filter((d) => d.type === type)
      .map((d) => d.title)
  );
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(base + ' ' + i)) i++;
  return base + ' ' + i;
}

export function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// True if `nodeId` is `ancestorId` itself, or lives anywhere inside its subtree.
// Used to block illegal drag moves (e.g. dropping a project into its own child).
export function isDescendantOf(documents, nodeId, ancestorId) {
  let current = documents[nodeId];
  const seen = new Set();
  while (current) {
    if (current.id === ancestorId) return true;
    if (seen.has(current.id)) return false; // corrupt cycle guard
    seen.add(current.id);
    current = current.parentId ? documents[current.parentId] : null;
  }
  return false;
}

// ---- Deadlines ----
// deadline is stored as 'YYYY-MM-DD' or null.
export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 'overdue' | 'today' | 'upcoming' | null
export function deadlineStatus(deadline) {
  if (!deadline) return null;
  const today = todayStr();
  if (deadline < today) return 'overdue';
  if (deadline === today) return 'today';
  return 'upcoming';
}

export function formatDeadline(deadline) {
  if (!deadline) return '';
  const [y, m, d] = deadline.split('-');
  return d + '.' + m + '.' + y;
}

// Scans every document + its rows/blocks/checklist items for deadlines that are
// today or overdue. Returns a flat list for the "reminder on launch" modal.
export function computeDueItems(documents) {
  const due = [];
  function pushIfDue(doc, label, deadline, extra) {
    const status = deadlineStatus(deadline);
    if (status === 'overdue' || status === 'today') {
      due.push({ docId: doc.id, docTitle: doc.title || 'Без назви', docType: doc.type, label, deadline, status, ...extra });
    }
  }
  function walkBlocks(doc, blocks) {
    blocks.forEach((b) => {
      pushIfDue(doc, b.text || 'Без назви', b.deadline, { itemId: b.id });
      walkBlocks(doc, b.children);
    });
  }
  Object.values(documents).forEach((doc) => {
    pushIfDue(doc, doc.title || 'Без назви', doc.deadline, { isDocLevel: true });
    (doc.items || []).forEach((it) => pushIfDue(doc, it.text || 'Без назви', it.deadline, { itemId: it.id }));
    if (doc.type === 'wbs') walkBlocks(doc, doc.blocks || []);
    (doc.checklist || []).forEach((it) => pushIfDue(doc, it.text || 'Без назви', it.deadline, { itemId: it.id }));
  });
  due.sort((a, b) => (a.status === b.status ? 0 : a.status === 'overdue' ? -1 : 1));
  return due;
}
