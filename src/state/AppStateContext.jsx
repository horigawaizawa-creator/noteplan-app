import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { genId } from '../lib/id.js';
import {
  DEFAULT_STAGES,
  CHECKLIST_WIDTH_DEFAULT,
  DEFAULT_CATEGORY_ORDER,
  DEFAULT_TITLES,
  WBS_VIEWS,
} from '../lib/constants.js';
import { loadState, saveState, saveFileBlob, deleteFileBlob } from '../lib/storage.js';
import { nextOrder, generateUniqueTitle, isDescendantOf, sortDocs, siblingSwapIds } from '../lib/docs.js';
import {
  updateBlockInTree,
  deleteBlockFromTree,
  addChildToBlock,
  addSiblingAfter,
  blockHasChildren,
  findBlockById,
  moveSiblingInTree,
} from '../lib/tree.js';
import { splitNonEmptyLines, linesToBlocks, linesToFlatItems, blocksToLines, itemsToLines } from '../lib/transform.js';

function emptyState() {
  return {
    documents: {},
    stages: DEFAULT_STAGES,
    currentDocId: null,
    trash: [],
    ui: {
      checklistWidth: CHECKLIST_WIDTH_DEFAULT,
      checklistCollapsed: false,
      sidebarCollapsed: false,
      appLockPassword: null,
      accentColor: null,
      theme: 'dark',
      categoryOrder: DEFAULT_CATEGORY_ORDER,
    },
    hydrated: false,
  };
}

function touchDoc(doc, patch) {
  return { ...doc, ...patch, updatedAt: Date.now() };
}

// Collects a document plus every descendant (used for cascading soft-delete / restore).
function collectSubtree(documents, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of Object.values(documents)) {
      if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) {
        ids.add(d.id);
        changed = true;
      }
    }
  }
  return Array.from(ids).map((id) => documents[id]);
}

function findWbsBlockIndex(blocks, id) {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) return { array: blocks, index: idx, parentId: null };
  for (const b of blocks) {
    const res = findWbsBlockIndex(b.children, id);
    if (res) return { ...res, parentId: res.parentId || b.id };
  }
  return null;
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      const loaded = action.loaded;
      if (!loaded) return { ...state, hydrated: true };
      return {
        ...state,
        documents: loaded.documents || {},
        stages: loaded.stages && loaded.stages.length ? loaded.stages : DEFAULT_STAGES,
        currentDocId: loaded.currentDocId || null,
        trash: loaded.trash || [],
        ui: {
          checklistWidth: (loaded.ui && loaded.ui.checklistWidth) || CHECKLIST_WIDTH_DEFAULT,
          checklistCollapsed: !!(loaded.ui && loaded.ui.checklistCollapsed),
          sidebarCollapsed: !!(loaded.ui && loaded.ui.sidebarCollapsed),
          appLockPassword: (loaded.ui && loaded.ui.appLockPassword) || null,
          accentColor: (loaded.ui && loaded.ui.accentColor) || null,
          theme: (loaded.ui && loaded.ui.theme === 'light') ? 'light' : 'dark',
          categoryOrder: (loaded.ui && loaded.ui.categoryOrder) || DEFAULT_CATEGORY_ORDER,
        },
        hydrated: true,
      };
    }

    case 'CREATE_DOC': {
      const { docType, parentId, id } = action;
      const now = Date.now();
      const title = generateUniqueTitle(state.documents, DEFAULT_TITLES[docType], docType);
      const base = {
        id,
        type: docType,
        title,
        parentId: parentId || null,
        priorityColor: null,
        stageId: null,
        pinned: false,
        deadline: null,
        order: nextOrder(state.documents, parentId || null),
        createdAt: now,
        updatedAt: now,
        checklist: [],
        attachments: [],
      };
      if (docType === 'note' || docType === 'project') base.content = '';
      if (docType === 'plan') base.items = [];
      if (docType === 'wbs') {
        base.blocks = [];
        base.wbsView = WBS_VIEWS.LIST;
        base.networkLinks = [];
      }
      return { ...state, documents: { ...state.documents, [id]: base }, currentDocId: id };
    }

    case 'CREATE_TRANSFORMED_DOC': {
      const { docType, id, title, blocks, items, content } = action;
      const now = Date.now();
      const base = {
        id,
        type: docType,
        title,
        parentId: null,
        priorityColor: null,
        stageId: null,
        pinned: false,
        deadline: null,
        order: nextOrder(state.documents, null),
        createdAt: now,
        updatedAt: now,
        checklist: [],
        attachments: [],
      };
      if (docType === 'wbs') {
        base.blocks = blocks;
        base.wbsView = WBS_VIEWS.LIST;
        base.networkLinks = [];
      }
      if (docType === 'plan') base.items = items;
      if (docType === 'note') base.content = content;
      return { ...state, documents: { ...state.documents, [id]: base }, currentDocId: id };
    }

    case 'UPDATE_DOC': {
      const doc = state.documents[action.id];
      if (!doc) return state;
      return { ...state, documents: { ...state.documents, [action.id]: touchDoc(doc, action.patch) } };
    }

    case 'SOFT_DELETE_DOC': {
      const { id } = action;
      if (!state.documents[id]) return state;
      const subtreeDocs = collectSubtree(state.documents, id);
      const newDocs = { ...state.documents };
      subtreeDocs.forEach((d) => delete newDocs[d.id]);
      let currentDocId = state.currentDocId;
      const removedIds = new Set(subtreeDocs.map((d) => d.id));
      if (removedIds.has(currentDocId)) {
        const remaining = Object.values(newDocs);
        currentDocId = remaining.length ? sortDocs(remaining)[0].id : null;
      }
      const rootDoc = state.documents[id];
      const trashEntry = {
        id: genId(),
        deletedAt: Date.now(),
        kind: 'doc',
        label: rootDoc.title || 'Без назви',
        docType: rootDoc.type,
        restore: { docs: subtreeDocs },
      };
      return { ...state, documents: newDocs, currentDocId, trash: [trashEntry, ...state.trash] };
    }

    case 'SOFT_DELETE_WBS_BLOCK': {
      const { docId, blockId } = action;
      const doc = state.documents[docId];
      if (!doc) return state;
      const found = findWbsBlockIndex(doc.blocks, blockId);
      if (!found) return state;
      const block = found.array[found.index];
      const blocks = deleteBlockFromTree(doc.blocks, blockId);
      const trashEntry = {
        id: genId(),
        deletedAt: Date.now(),
        kind: 'wbsBlock',
        label: block.text || 'Без назви',
        restore: { docId, parentBlockId: found.parentId, index: found.index, block },
      };
      return {
        ...state,
        documents: { ...state.documents, [docId]: touchDoc(doc, { blocks }) },
        trash: [trashEntry, ...state.trash],
      };
    }

    case 'SOFT_DELETE_PLAN_ITEM': {
      const { docId, itemId } = action;
      const doc = state.documents[docId];
      if (!doc) return state;
      const index = doc.items.findIndex((it) => it.id === itemId);
      if (index === -1) return state;
      const item = doc.items[index];
      const items = doc.items.filter((it) => it.id !== itemId);
      const trashEntry = {
        id: genId(),
        deletedAt: Date.now(),
        kind: 'planItem',
        label: item.text || 'Без назви',
        restore: { docId, index, item },
      };
      return {
        ...state,
        documents: { ...state.documents, [docId]: touchDoc(doc, { items }) },
        trash: [trashEntry, ...state.trash],
      };
    }

    case 'SOFT_DELETE_CHECKLIST_ITEM': {
      const { docId, itemId } = action;
      const doc = state.documents[docId];
      if (!doc) return state;
      const index = doc.checklist.findIndex((it) => it.id === itemId);
      if (index === -1) return state;
      const item = doc.checklist[index];
      const checklist = doc.checklist.filter((it) => it.id !== itemId);
      const trashEntry = {
        id: genId(),
        deletedAt: Date.now(),
        kind: 'checklistItem',
        label: item.text || 'Без назви',
        restore: { docId, index, item },
      };
      return {
        ...state,
        documents: { ...state.documents, [docId]: touchDoc(doc, { checklist }) },
        trash: [trashEntry, ...state.trash],
      };
    }

    case 'RESTORE_TRASH_ENTRY': {
      const entry = state.trash.find((t) => t.id === action.trashId);
      if (!entry) return state;
      const trash = state.trash.filter((t) => t.id !== action.trashId);

      if (entry.kind === 'doc') {
        const newDocs = { ...state.documents };
        entry.restore.docs.forEach((d) => { newDocs[d.id] = d; });
        return { ...state, documents: newDocs, trash, currentDocId: entry.restore.docs[0]?.id || state.currentDocId };
      }
      const doc = state.documents[entry.restore.docId];
      if (!doc) return { ...state, trash };
      if (entry.kind === 'wbsBlock') {
        let blocks;
        const { parentBlockId, index, block } = entry.restore;
        if (!parentBlockId) {
          blocks = doc.blocks.slice();
          blocks.splice(Math.min(index, blocks.length), 0, block);
        } else {
          blocks = addChildToBlock(doc.blocks, parentBlockId, block);
        }
        return { ...state, documents: { ...state.documents, [doc.id]: touchDoc(doc, { blocks }) }, trash };
      }
      if (entry.kind === 'planItem') {
        const items = doc.items.slice();
        items.splice(Math.min(entry.restore.index, items.length), 0, entry.restore.item);
        return { ...state, documents: { ...state.documents, [doc.id]: touchDoc(doc, { items }) }, trash };
      }
      if (entry.kind === 'checklistItem') {
        const checklist = doc.checklist.slice();
        checklist.splice(Math.min(entry.restore.index, checklist.length), 0, entry.restore.item);
        return { ...state, documents: { ...state.documents, [doc.id]: touchDoc(doc, { checklist }) }, trash };
      }
      return { ...state, trash };
    }

    case 'PURGE_TRASH_ENTRY':
      return { ...state, trash: state.trash.filter((t) => t.id !== action.trashId) };

    case 'EMPTY_TRASH':
      return { ...state, trash: [] };

    case 'SELECT_DOC':
      return { ...state, currentDocId: action.id };

    case 'TOGGLE_PIN': {
      const doc = state.documents[action.id];
      if (!doc) return state;
      return { ...state, documents: { ...state.documents, [action.id]: touchDoc(doc, { pinned: !doc.pinned }) } };
    }

    case 'MOVE_DOC_RELATIVE': {
      const { draggedId, targetId, mode } = action;
      const documents = state.documents;
      const dragged = documents[draggedId];
      const target = documents[targetId];
      if (!dragged || !target || draggedId === targetId) return state;

      const newParentId = mode === 'into' ? targetId : target.parentId ?? null;
      if (newParentId === draggedId) return state;
      if (newParentId && isDescendantOf(documents, newParentId, draggedId)) return state;

      const destSiblings = Object.values(documents)
        .filter((d) => d.parentId === (newParentId ?? null) && d.id !== draggedId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      let insertAt = destSiblings.length;
      if (mode === 'beside') {
        const idx = destSiblings.findIndex((d) => d.id === targetId);
        insertAt = idx === -1 ? destSiblings.length : idx + 1;
      }

      const newOrderIds = destSiblings.map((d) => d.id);
      newOrderIds.splice(insertAt, 0, draggedId);

      const newDocs = { ...documents };
      newOrderIds.forEach((did, idx) => {
        const d = did === draggedId ? { ...dragged, parentId: newParentId } : documents[did];
        newDocs[did] = { ...d, order: idx, updatedAt: did === draggedId ? Date.now() : d.updatedAt };
      });

      return { ...state, documents: newDocs };
    }

    case 'MOVE_DOCS_RELATIVE_BULK': {
      // Moves several dragged docs together, preserving their relative order.
      let next = state;
      action.draggedIds.forEach((draggedId) => {
        next = reducer(next, { type: 'MOVE_DOC_RELATIVE', draggedId, targetId: action.targetId, mode: action.mode });
      });
      return next;
    }

    // Swaps just the `order` field of two documents. Used by the "move up" /
    // "move down" buttons -- the touch- and keyboard-friendly alternative to
    // drag-and-drop reordering, since native HTML5 drag-and-drop never fires
    // on mobile browsers. Deliberately minimal: unlike a full re-sequencing,
    // it only touches the two documents actually involved.
    case 'SWAP_DOC_ORDER': {
      const a = state.documents[action.firstId];
      const b = state.documents[action.secondId];
      if (!a || !b) return state;
      return {
        ...state,
        documents: { ...state.documents, [a.id]: { ...a, order: b.order }, [b.id]: { ...b, order: a.order } },
      };
    }

    case 'REORDER_CATEGORIES':
      return { ...state, ui: { ...state.ui, categoryOrder: action.orderedTypes } };

    // ---- Plan items ----
    case 'ADD_PLAN_ITEM': {
      const doc = state.documents[action.docId];
      if (!doc || doc.type !== 'plan') return state;
      return {
        ...state,
        documents: { ...state.documents, [action.docId]: touchDoc(doc, { items: [...doc.items, action.item] }) },
      };
    }
    case 'UPDATE_PLAN_ITEM': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const items = doc.items.map((it) => (it.id === action.itemId ? { ...it, ...action.patch } : it));
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { items }) } };
    }
    case 'REORDER_PLAN_ITEMS': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const map = new Map(doc.items.map((it) => [it.id, it]));
      const items = action.orderedIds.map((id) => map.get(id)).filter(Boolean);
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { items }) } };
    }

    // ---- WBS blocks ----
    case 'ADD_WBS_ROOT_BLOCK': {
      const doc = state.documents[action.docId];
      if (!doc || doc.type !== 'wbs') return state;
      return {
        ...state,
        documents: { ...state.documents, [action.docId]: touchDoc(doc, { blocks: [...doc.blocks, action.block] }) },
      };
    }
    case 'ADD_WBS_CHILD_BLOCK': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const blocks = addChildToBlock(doc.blocks, action.parentBlockId, action.block);
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { blocks }) } };
    }
    case 'ADD_WBS_SIBLING_BLOCK': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const blocks = addSiblingAfter(doc.blocks, action.siblingId, action.block);
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { blocks }) } };
    }
    case 'UPDATE_WBS_BLOCK': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const blocks = updateBlockInTree(doc.blocks, action.blockId, action.patch);
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { blocks }) } };
    }
    case 'MOVE_WBS_BLOCK': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const blocks = moveSiblingInTree(doc.blocks, action.blockId, action.direction);
      if (blocks === doc.blocks) return state; // already at that edge -- no-op
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { blocks }) } };
    }
    case 'SET_WBS_VIEW': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { wbsView: action.view }) } };
    }
    case 'ADD_NETWORK_LINK': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      return {
        ...state,
        documents: { ...state.documents, [action.docId]: touchDoc(doc, { networkLinks: [...(doc.networkLinks || []), action.link] }) },
      };
    }
    case 'DELETE_NETWORK_LINK': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const networkLinks = (doc.networkLinks || []).filter((l) => l.id !== action.linkId);
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { networkLinks }) } };
    }

    // ---- Checklist ----
    case 'ADD_CHECKLIST_ITEM': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const item = { id: action.id, text: action.text, checked: false, deadline: null };
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { checklist: [...doc.checklist, item] }) } };
    }
    case 'TOGGLE_CHECKLIST_ITEM': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const checklist = doc.checklist.map((it) => (it.id === action.itemId ? { ...it, checked: !it.checked } : it));
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { checklist }) } };
    }
    case 'UPDATE_CHECKLIST_ITEM': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const checklist = doc.checklist.map((it) => (it.id === action.itemId ? { ...it, ...action.patch } : it));
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { checklist }) } };
    }

    // ---- Attachments ----
    case 'ADD_ATTACHMENT': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      return {
        ...state,
        documents: { ...state.documents, [action.docId]: touchDoc(doc, { attachments: [...(doc.attachments || []), action.attachment] }) },
      };
    }
    case 'DELETE_ATTACHMENT': {
      const doc = state.documents[action.docId];
      if (!doc) return state;
      const attachments = (doc.attachments || []).filter((a) => a.id !== action.attachmentId);
      return { ...state, documents: { ...state.documents, [action.docId]: touchDoc(doc, { attachments }) } };
    }

    // ---- Stages (settings) ----
    case 'ADD_STAGE':
      return { ...state, stages: [...state.stages, action.stage] };
    case 'UPDATE_STAGE':
      return { ...state, stages: state.stages.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) };
    case 'DELETE_STAGE': {
      const stages = state.stages.filter((s) => s.id !== action.id);
      const clearStage = (obj) => (obj && obj.stageId === action.id ? { ...obj, stageId: null } : obj);
      const documents = {};
      for (const [id, doc] of Object.entries(state.documents)) {
        let next = clearStage(doc);
        if (doc.type === 'plan') next = { ...next, items: doc.items.map(clearStage) };
        if (doc.type === 'wbs') {
          const clearTree = (blocks) => blocks.map((b) => ({ ...clearStage(b), children: clearTree(b.children) }));
          next = { ...next, blocks: clearTree(doc.blocks) };
        }
        documents[id] = next;
      }
      return { ...state, stages, documents };
    }

    // ---- UI ----
    case 'SET_CHECKLIST_WIDTH':
      return { ...state, ui: { ...state.ui, checklistWidth: action.width } };
    case 'TOGGLE_CHECKLIST_COLLAPSED':
      return { ...state, ui: { ...state.ui, checklistCollapsed: !state.ui.checklistCollapsed } };
    case 'TOGGLE_SIDEBAR_COLLAPSED':
      return { ...state, ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed } };
    case 'SET_APP_LOCK_PASSWORD':
      return { ...state, ui: { ...state.ui, appLockPassword: action.password || null } };
    case 'SET_ACCENT_COLOR':
      return { ...state, ui: { ...state.ui, accentColor: action.color || null } };
    case 'SET_THEME':
      return { ...state, ui: { ...state.ui, theme: action.theme === 'light' ? 'light' : 'dark' } };

    default:
      return state;
  }
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [justCreatedId, setJustCreatedId] = useState(null);
  const [focusBlockId, setFocusBlockId] = useState(null);
  const [toasts, setToasts] = useState([]);
  // Which single pane is showing in the mobile layout: 'sidebar' | 'workspace' | 'checklist'.
  // Has no visual effect on the desktop 3-pane layout (see the >=900px CSS) --
  // it only drives which pane is visible once the viewport drops below the
  // mobile breakpoint, so it's safe to always track regardless of screen size.
  const [activePanel, setActivePanel] = useState('sidebar');
  // Session-only unlock state for the "simple screen lock" privacy feature
  // (app password + per-document password). Deliberately NOT persisted, so
  // everything re-locks on every fresh page load, like a phone's lock
  // screen. This is a privacy screen, not real encryption -- the password
  // is stored in plain text in IndexedDB and is trivially readable via the
  // browser's own dev tools; it only keeps casual glances out.
  const [appUnlocked, setAppUnlocked] = useState(false);
  const [unlockedDocIds, setUnlockedDocIds] = useState(() => new Set());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    loadState().then((loaded) => {
      if (!cancelled) dispatch({ type: 'HYDRATE', loaded });
    });
    return () => { cancelled = true; };
  }, []);

  // Whenever a document becomes the current one -- on first load (resuming a
  // previous session), when the user taps a doc in the sidebar, follows a
  // backlink, creates a new doc, or picks one from the due-today reminder --
  // jump to the workspace pane so it's immediately visible on mobile.
  useEffect(() => {
    if (state.currentDocId) setActivePanel('workspace');
  }, [state.currentDocId]);

  useEffect(() => {
    if (!state.hydrated) return;
    const t = setTimeout(() => saveState(state), 400);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const handler = () => { if (stateRef.current.hydrated) saveState(stateRef.current); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  function showToast(message, opts) {
    const id = genId();
    setToasts((t) => [...t, { id, message, isError: opts?.isError, action: opts?.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 5000 : 2600);
    return id;
  }
  function dismissToast(id) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  function createDoc(docType, parentId = null) {
    const id = genId();
    dispatch({ type: 'CREATE_DOC', docType, parentId, id });
    setJustCreatedId(id);
    return id;
  }

  function deleteDocToTrash(id) {
    const doc = state.documents[id];
    if (!doc) return;
    dispatch({ type: 'SOFT_DELETE_DOC', id });
    showToast('Документ переміщено в кошик: «' + (doc.title || 'Без назви') + '»', {
      action: { label: 'Скасувати', onClick: () => undoLastTrashByLabel() },
    });
  }

  // Undo button on the toast restores the most recently trashed entry
  // (works because soft-deletes always prepend to the trash array).
  function undoLastTrashByLabel() {
    const entry = stateRef.current.trash[0];
    if (entry) dispatch({ type: 'RESTORE_TRASH_ENTRY', trashId: entry.id });
  }

  function restoreTrashEntry(trashId) {
    dispatch({ type: 'RESTORE_TRASH_ENTRY', trashId });
  }
  function purgeTrashEntry(trashId) {
    dispatch({ type: 'PURGE_TRASH_ENTRY', trashId });
  }
  function emptyTrash() {
    dispatch({ type: 'EMPTY_TRASH' });
  }

  function selectDoc(id) {
    dispatch({ type: 'SELECT_DOC', id });
  }
  function togglePin(id) {
    dispatch({ type: 'TOGGLE_PIN', id });
  }
  function updateDoc(id, patch) {
    dispatch({ type: 'UPDATE_DOC', id, patch });
  }
  function moveDocRelative(draggedId, targetId, mode) {
    dispatch({ type: 'MOVE_DOC_RELATIVE', draggedId, targetId, mode });
  }
  function moveDocsRelativeBulk(draggedIds, targetId, mode) {
    dispatch({ type: 'MOVE_DOCS_RELATIVE_BULK', draggedIds, targetId, mode });
  }
  // Moves a document one position earlier/later among its current siblings
  // (same project for nested docs, same top-level type section otherwise) --
  // the tap-friendly equivalent of dragging it past its neighbour.
  function moveSiblingDoc(docId, direction) {
    const pair = siblingSwapIds(state.documents, docId, direction);
    if (pair) dispatch({ type: 'SWAP_DOC_ORDER', firstId: pair[0], secondId: pair[1] });
  }
  // Moves a document into a project (or, with newParentId=null, back out to
  // the top level) without needing to drag it there.
  function moveDocToParent(docId, newParentId) {
    const doc = state.documents[docId];
    if (!doc || docId === newParentId) return;
    if (newParentId && isDescendantOf(state.documents, newParentId, docId)) return;
    updateDoc(docId, { parentId: newParentId, order: nextOrder(state.documents, newParentId) });
  }
  function reorderCategories(orderedTypes) {
    dispatch({ type: 'REORDER_CATEGORIES', orderedTypes });
  }

  function addPlanItem(docId) {
    const id = genId();
    dispatch({ type: 'ADD_PLAN_ITEM', docId, item: { id, text: '', stageId: null, deadline: null } });
    setFocusBlockId(id);
    return id;
  }
  function updatePlanItem(docId, itemId, patch) {
    dispatch({ type: 'UPDATE_PLAN_ITEM', docId, itemId, patch });
  }
  function deletePlanItemToTrash(docId, itemId) {
    dispatch({ type: 'SOFT_DELETE_PLAN_ITEM', docId, itemId });
    showToast('Крок переміщено в кошик', { action: { label: 'Скасувати', onClick: undoLastTrashByLabel } });
  }
  function reorderPlanItems(docId, orderedIds) {
    dispatch({ type: 'REORDER_PLAN_ITEMS', docId, orderedIds });
  }

  function addWbsRootBlock(docId) {
    const id = genId();
    dispatch({ type: 'ADD_WBS_ROOT_BLOCK', docId, block: { id, text: '', stageId: null, deadline: null, children: [] } });
    setFocusBlockId(id);
    return id;
  }
  function addWbsChildBlock(docId, parentBlockId) {
    const id = genId();
    dispatch({ type: 'ADD_WBS_CHILD_BLOCK', docId, parentBlockId, block: { id, text: '', stageId: null, deadline: null, children: [] } });
    setFocusBlockId(id);
    return id;
  }
  function addWbsSiblingBlock(docId, siblingId) {
    const id = genId();
    dispatch({ type: 'ADD_WBS_SIBLING_BLOCK', docId, siblingId, block: { id, text: '', stageId: null, deadline: null, children: [] } });
    setFocusBlockId(id);
    return id;
  }
  function updateWbsBlock(docId, blockId, patch) {
    dispatch({ type: 'UPDATE_WBS_BLOCK', docId, blockId, patch });
  }
  // Moves a WBS block one position earlier/later among its sibling blocks.
  // WBS blocks have no drag-and-drop at all today (only add/delete), so this
  // is the only way to reorder them -- on any device.
  function moveWbsBlock(docId, blockId, direction) {
    dispatch({ type: 'MOVE_WBS_BLOCK', docId, blockId, direction });
  }
  function deleteWbsBlockToTrash(docId, blockId) {
    dispatch({ type: 'SOFT_DELETE_WBS_BLOCK', docId, blockId });
    showToast('Блок переміщено в кошик', { action: { label: 'Скасувати', onClick: undoLastTrashByLabel } });
  }
  function setWbsView(docId, view) {
    dispatch({ type: 'SET_WBS_VIEW', docId, view });
  }
  function addNetworkLink(docId, fromId, toId) {
    dispatch({ type: 'ADD_NETWORK_LINK', docId, link: { id: genId(), fromId, toId } });
  }
  function deleteNetworkLink(docId, linkId) {
    dispatch({ type: 'DELETE_NETWORK_LINK', docId, linkId });
  }

  function addChecklistItem(docId, text) {
    dispatch({ type: 'ADD_CHECKLIST_ITEM', docId, id: genId(), text });
  }
  function toggleChecklistItem(docId, itemId) {
    dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', docId, itemId });
  }
  function updateChecklistItem(docId, itemId, patch) {
    dispatch({ type: 'UPDATE_CHECKLIST_ITEM', docId, itemId, patch });
  }
  function deleteChecklistItemToTrash(docId, itemId) {
    dispatch({ type: 'SOFT_DELETE_CHECKLIST_ITEM', docId, itemId });
    showToast('Задачу переміщено в кошик', { action: { label: 'Скасувати', onClick: undoLastTrashByLabel } });
  }

  async function addAttachment(docId, file) {
    const id = genId();
    await saveFileBlob(id, file);
    dispatch({
      type: 'ADD_ATTACHMENT',
      docId,
      attachment: { id, name: file.name, mime: file.type, size: file.size, addedAt: Date.now() },
    });
  }
  async function deleteAttachment(docId, attachmentId) {
    await deleteFileBlob(attachmentId);
    dispatch({ type: 'DELETE_ATTACHMENT', docId, attachmentId });
  }

  function transformNoteToWbs(docId) {
    const doc = state.documents[docId];
    if (!doc || doc.type !== 'note') return;
    const lines = splitNonEmptyLines(doc.content);
    if (!lines.length) return showToast('Нотатка порожня — немає що перетворювати', { isError: true });
    const blocks = linesToBlocks(lines, genId);
    const id = genId();
    dispatch({ type: 'CREATE_TRANSFORMED_DOC', docType: 'wbs', id, title: (doc.title || 'Без назви') + ' (WBS)', blocks });
    showToast('⚡ WBS-план створено з нотатки');
  }
  function transformNoteToPlan(docId) {
    const doc = state.documents[docId];
    if (!doc || doc.type !== 'note') return;
    const lines = splitNonEmptyLines(doc.content);
    if (!lines.length) return showToast('Нотатка порожня — немає що перетворювати', { isError: true });
    const items = linesToFlatItems(lines, genId);
    const id = genId();
    dispatch({ type: 'CREATE_TRANSFORMED_DOC', docType: 'plan', id, title: (doc.title || 'Без назви') + ' (План)', items });
    showToast('📋 План створено з нотатки');
  }
  function transformWbsToNote(docId) {
    const doc = state.documents[docId];
    if (!doc || doc.type !== 'wbs') return;
    if (!doc.blocks.length) return showToast('WBS-план порожній — немає що перетворювати', { isError: true });
    const content = blocksToLines(doc.blocks).join('\n');
    const id = genId();
    dispatch({ type: 'CREATE_TRANSFORMED_DOC', docType: 'note', id, title: (doc.title || 'Без назви') + ' (Нотатка)', content });
    showToast('📝 Нотатку створено з WBS-плану');
  }
  function transformPlanToNote(docId) {
    const doc = state.documents[docId];
    if (!doc || doc.type !== 'plan') return;
    if (!doc.items.length) return showToast('План порожній — немає що перетворювати', { isError: true });
    const content = itemsToLines(doc.items).join('\n');
    const id = genId();
    dispatch({ type: 'CREATE_TRANSFORMED_DOC', docType: 'note', id, title: (doc.title || 'Без назви') + ' (Нотатка)', content });
    showToast('📝 Нотатку створено з плану');
  }

  function addStage(name, color) {
    dispatch({ type: 'ADD_STAGE', stage: { id: genId(), name, color } });
  }
  function updateStage(id, patch) {
    dispatch({ type: 'UPDATE_STAGE', id, patch });
  }
  function deleteStage(id) {
    dispatch({ type: 'DELETE_STAGE', id });
  }

  function setChecklistWidth(width) {
    dispatch({ type: 'SET_CHECKLIST_WIDTH', width });
  }
  function toggleChecklistCollapsed() {
    dispatch({ type: 'TOGGLE_CHECKLIST_COLLAPSED' });
  }
  function toggleSidebarCollapsed() {
    dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' });
  }
  function setAppLockPassword(password) {
    dispatch({ type: 'SET_APP_LOCK_PASSWORD', password: password || null });
    if (password) setAppUnlocked(true);
  }
  function setAccentColor(color) {
    dispatch({ type: 'SET_ACCENT_COLOR', color: color || null });
  }
  function setTheme(theme) {
    dispatch({ type: 'SET_THEME', theme });
  }
  function unlockApp(password) {
    if (password && password === state.ui.appLockPassword) {
      setAppUnlocked(true);
      return true;
    }
    return false;
  }
  // Re-locks the app immediately, without waiting for a page reload -- for
  // when you want to hand the device to someone else right now.
  function lockAppNow() {
    setAppUnlocked(false);
  }
  function setDocLockPassword(docId, password) {
    updateDoc(docId, { lockPassword: password || null });
    // Setting/removing a password already proves you're authorized for it
    // this session -- no need to also make you re-enter it immediately.
    if (password) {
      setUnlockedDocIds((prev) => {
        const next = new Set(prev);
        next.add(docId);
        return next;
      });
    }
  }
  function unlockDoc(docId, password) {
    const doc = state.documents[docId];
    if (doc && password && password === doc.lockPassword) {
      setUnlockedDocIds((prev) => {
        const next = new Set(prev);
        next.add(docId);
        return next;
      });
      return true;
    }
    return false;
  }
  // Re-locks this one document immediately, without a page reload.
  function lockDocNow(docId) {
    setUnlockedDocIds((prev) => {
      if (!prev.has(docId)) return prev;
      const next = new Set(prev);
      next.delete(docId);
      return next;
    });
  }

  const value = {
    state,
    justCreatedId,
    clearJustCreatedId: () => setJustCreatedId(null),
    focusBlockId,
    clearFocusBlockId: () => setFocusBlockId(null),
    toasts,
    showToast,
    dismissToast,
    // Mobile single-pane navigation: which of the 3 panes is on screen.
    activePanel,
    goToSidebarPanel: () => setActivePanel('sidebar'),
    goToWorkspacePanel: () => setActivePanel('workspace'),
    goToChecklistPanel: () => setActivePanel('checklist'),
    appUnlocked,
    unlockApp,
    lockAppNow,
    setAppLockPassword,
    setAccentColor,
    setTheme,
    unlockedDocIds,
    unlockDoc,
    lockDocNow,
    setDocLockPassword,
    createDoc,
    deleteDocToTrash,
    restoreTrashEntry,
    purgeTrashEntry,
    emptyTrash,
    selectDoc,
    togglePin,
    updateDoc,
    moveDocRelative,
    moveDocsRelativeBulk,
    moveSiblingDoc,
    moveDocToParent,
    reorderCategories,
    addPlanItem,
    updatePlanItem,
    deletePlanItemToTrash,
    reorderPlanItems,
    addWbsRootBlock,
    addWbsChildBlock,
    addWbsSiblingBlock,
    updateWbsBlock,
    moveWbsBlock,
    deleteWbsBlockToTrash,
    setWbsView,
    addNetworkLink,
    deleteNetworkLink,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItem,
    deleteChecklistItemToTrash,
    addAttachment,
    deleteAttachment,
    transformNoteToWbs,
    transformNoteToPlan,
    transformWbsToNote,
    transformPlanToNote,
    addStage,
    updateStage,
    deleteStage,
    setChecklistWidth,
    toggleChecklistCollapsed,
    toggleSidebarCollapsed,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

export { AppStateContext, reducer };
