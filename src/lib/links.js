// Link syntax embedded in text: [[docId]] for whole-document links,
// [[docId::subId]] for a link to a specific row/block/checklist item.
// Using real internal ids (not titles) keeps links working even after renames.
const LINK_RE = /\[\[([a-zA-Z0-9_]+)(?:::([a-zA-Z0-9_]+))?\]\]/g;

export function extractLinks(text) {
  if (!text) return [];
  const links = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text))) {
    links.push({ docId: m[1], subId: m[2] || null, raw: m[0] });
  }
  return links;
}

function findSubLabel(doc, subId) {
  if (!doc) return null;
  if (doc.type === 'plan') {
    const it = (doc.items || []).find((i) => i.id === subId);
    if (it) return it.text || 'Без назви';
  }
  if (doc.type === 'wbs') {
    function walk(blocks) {
      for (const b of blocks) {
        if (b.id === subId) return b.text || 'Без назви';
        const found = walk(b.children || []);
        if (found) return found;
      }
      return null;
    }
    const found = walk(doc.blocks || []);
    if (found) return found;
  }
  const chk = (doc.checklist || []).find((i) => i.id === subId);
  if (chk) return chk.text || 'Без назви';
  return null;
}

// Resolves a [[docId]] or [[docId::subId]] reference to a live, current label.
export function resolveLink(documents, docId, subId) {
  const doc = documents[docId];
  if (!doc) return { ok: false, label: 'Видалено' };
  if (!subId) return { ok: true, label: doc.title || 'Без назви', docId, subId: null };
  const label = findSubLabel(doc, subId);
  if (label == null) return { ok: false, label: 'Видалено' };
  return { ok: true, label, docId, subId };
}

// Renders text with [[..]] tokens replaced by { type:'text'|'link', ... } parts,
// so a component can render plain text and clickable link pills in sequence.
export function renderLinkParts(documents, text) {
  if (!text) return [];
  const parts = [];
  let lastIndex = 0;
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text))) {
    if (m.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    const resolved = resolveLink(documents, m[1], m[2] || null);
    parts.push({ type: 'link', docId: m[1], subId: m[2] || null, label: resolved.label, ok: resolved.ok });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  return parts;
}

// Scans every text field in every document for references to (targetDocId, targetSubId).
// targetSubId === null means "links to the whole document" AND matches sub-links too
// (a link to a specific row still counts as referencing its parent document).
export function computeBacklinks(documents, targetDocId, targetSubId) {
  const results = [];
  function checkText(doc, text, context) {
    extractLinks(text).forEach((l) => {
      if (l.docId !== targetDocId) return;
      if (targetSubId && l.subId !== targetSubId) return;
      results.push({ docId: doc.id, docTitle: doc.title || 'Без назви', docType: doc.type, context, snippet: text.slice(0, 120) });
    });
  }
  function walkBlocks(doc, blocks) {
    blocks.forEach((b) => {
      checkText(doc, b.text, 'блок WBS');
      walkBlocks(doc, b.children || []);
    });
  }
  Object.values(documents).forEach((doc) => {
    if (doc.type === 'note' || doc.type === 'project') checkText(doc, doc.content, 'текст');
    (doc.items || []).forEach((it) => checkText(doc, it.text, 'крок плану'));
    if (doc.type === 'wbs') walkBlocks(doc, doc.blocks || []);
    (doc.checklist || []).forEach((it) => checkText(doc, it.text, 'чек-лист'));
  });
  return results;
}
