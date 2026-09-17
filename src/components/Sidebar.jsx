import React, { useState, useRef } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { useOutsideClick } from './UiBits.jsx';
import { DOC_TYPE_ICONS, CATEGORY_LABELS, CATEGORY_EMPTY_LABELS, SIDEBAR_COLLAPSED_WIDTH } from '../lib/constants.js';
import { topLevelByType, childrenOf, validMoveTargets, docOrDescendantMatches, normalizeSearchQuery } from '../lib/docs.js';
import { useIsMobileLayout } from '../lib/useIsMobileLayout.js';

export default function Sidebar({ onOpenSettings, onOpenStages, onOpenTrash }) {
  const { state, reorderCategories, activePanel, toggleSidebarCollapsed } = useAppState();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [categoryDragOver, setCategoryDragOver] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobileLayout = useIsMobileLayout();
  // On mobile the sidebar is either the full-screen active panel or hidden
  // entirely -- the desktop "collapsed to a thin strip" preference doesn't
  // apply there, same treatment as ChecklistPanel's forceExpanded.
  const forceExpanded = isMobileLayout && activePanel === 'sidebar';
  const sidebarCollapsed = state.ui.sidebarCollapsed;

  const categoryOrder = state.ui.categoryOrder;
  const docsByType = {
    project: topLevelByType(state.documents, 'project'),
    note: topLevelByType(state.documents, 'note'),
    plan: topLevelByType(state.documents, 'plan'),
    wbs: topLevelByType(state.documents, 'wbs'),
  };
  const isSearching = !!normalizeSearchQuery(searchQuery);
  const visibleByType = isSearching
    ? {
        project: docsByType.project.filter((d) => docOrDescendantMatches(state.documents, d.id, searchQuery)),
        note: docsByType.note.filter((d) => docOrDescendantMatches(state.documents, d.id, searchQuery)),
        plan: docsByType.plan.filter((d) => docOrDescendantMatches(state.documents, d.id, searchQuery)),
        wbs: docsByType.wbs.filter((d) => docOrDescendantMatches(state.documents, d.id, searchQuery)),
      }
    : docsByType;
  const hasSearchResults = categoryOrder.some((type) => (visibleByType[type] || []).length > 0);

  function toggleSelected(id, additive) {
    setSelectedIds((prev) => {
      const next = additive ? new Set(prev) : new Set();
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleCategoryDragStart(type) {
    setDraggedCategory(type);
  }
  function handleCategoryDrop(type) {
    if (!draggedCategory || draggedCategory === type) {
      setCategoryDragOver(null);
      return;
    }
    const order = categoryOrder.filter((t) => t !== draggedCategory);
    const idx = order.indexOf(type);
    order.splice(idx + 1, 0, draggedCategory);
    reorderCategories(order);
    setDraggedCategory(null);
    setCategoryDragOver(null);
  }

  if (sidebarCollapsed && !forceExpanded) {
    return (
      <aside className="sidebar collapsed" style={isMobileLayout ? undefined : { width: SIDEBAR_COLLAPSED_WIDTH }}>
        <button type="button" className="sidebar-expand-btn" title="Показати список документів" onClick={toggleSidebarCollapsed}>
          🧭<br />▶
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
      <div className="sidebar-header">
        <h1 className="app-title">🧭 Лок.Планувальник</h1>
        <button type="button" className="sidebar-collapse-btn" title="Згорнути список документів" onClick={toggleSidebarCollapsed}>
          ◀
        </button>
      </div>

      <CreateMenu />

      <div className="sidebar-search">
        <input
          type="search"
          className="sidebar-search-input"
          value={searchQuery}
          placeholder="Пошук за назвою..."
          aria-label="Пошук документів за назвою"
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="sidebar-search-clear"
            aria-label="Очистити пошук"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>

      <div className="doc-list-container">
        {isSearching && !hasSearchResults && (
          <div className="doc-section-empty">Нічого не знайдено</div>
        )}
        {(!isSearching || hasSearchResults) && categoryOrder.map((type) => (
          <div
            key={type}
            draggable
            onDragStart={() => handleCategoryDragStart(type)}
            onDragOver={(e) => {
              e.preventDefault();
              setCategoryDragOver(type);
            }}
            onDragLeave={() => setCategoryDragOver((c) => (c === type ? null : c))}
            onDrop={() => handleCategoryDrop(type)}
            className={categoryDragOver === type && draggedCategory !== type ? 'category-drop-target' : ''}
          >
            <DocSection
              type={type}
              title={CATEGORY_LABELS[type]}
              docs={visibleByType[type]}
              emptyText={CATEGORY_EMPTY_LABELS[type]}
              selectedIds={selectedIds}
              toggleSelected={toggleSelected}
              clearSelection={clearSelection}
              searchQuery={searchQuery}
              hideIfEmpty={isSearching}
            />
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="btn-settings" onClick={onOpenTrash}>
          🗑 Кошик
        </button>
        <button type="button" className="btn-settings" onClick={onOpenStages}>
          📊 Стадії розробки
        </button>
        <button type="button" className="btn-settings" onClick={onOpenSettings}>
          ⚙️ Налаштування
        </button>
      </div>
    </aside>
  );
}

function CreateMenu() {
  const { createDoc, updateDoc, showToast } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));
  const importInputRef = useRef(null);

  function handleCreate(type) {
    createDoc(type, null);
    setOpen(false);
  }

  function handleImportClick() {
    importInputRef.current?.click();
    setOpen(false);
  }

  function looksLikeText(file) {
    if (file.type && file.type.startsWith('text/')) return true;
    if (!file.type) return /\.(txt|md|markdown)$/i.test(file.name);
    return /\.(txt|md|markdown)$/i.test(file.name);
  }

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!looksLikeText(file)) {
      showToast('Можна імпортувати лише текстові файли (.txt, .md)', { isError: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Імпортована нотатка';
      const id = createDoc('note', null);
      updateDoc(id, { title, content: text });
    };
    reader.onerror = () => showToast('Не вдалося прочитати файл', { isError: true });
    reader.readAsText(file);
  }

  return (
    <div className="create-menu" ref={ref}>
      <button type="button" className="btn-create-main" onClick={() => setOpen((o) => !o)}>
        <span>+ Створити</span>
        <span className="chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="create-menu-dropdown">
          <button type="button" onClick={() => handleCreate('note')}>{DOC_TYPE_ICONS.note} Нотатка</button>
          <button type="button" onClick={() => handleCreate('plan')}>{DOC_TYPE_ICONS.plan} План</button>
          <button type="button" onClick={() => handleCreate('wbs')}>{DOC_TYPE_ICONS.wbs} WBS План</button>
          <button type="button" onClick={() => handleCreate('project')}>{DOC_TYPE_ICONS.project} Проєкт</button>
          <div className="doc-item-menu-divider" />
          <button type="button" onClick={handleImportClick}>📥 Імпортувати текстовий файл...</button>
        </div>
      )}
      <input
        ref={importInputRef}
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        hidden
        onChange={handleImportFile}
      />
    </div>
  );
}

function DocSection({ type, title, docs, emptyText, selectedIds, toggleSelected, clearSelection, searchQuery, hideIfEmpty }) {
  if (hideIfEmpty && docs.length === 0) return null;
  return (
    <div className="doc-section">
      <div className="doc-section-heading" title="Перетягніть, щоб змінити порядок категорій">
        ⠿ {title}
      </div>
      {docs.length === 0 ? (
        <div className="doc-section-empty">{emptyText}</div>
      ) : (
        <div className="doc-list">
          {docs.map((d) => (
            <DocItem
              key={d.id}
              doc={d}
              depth={0}
              selectedIds={selectedIds}
              toggleSelected={toggleSelected}
              clearSelection={clearSelection}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocItem({ doc, depth, selectedIds, toggleSelected, clearSelection, searchQuery }) {
  const { state, selectDoc, togglePin, moveDocRelative, moveDocsRelativeBulk } = useAppState();
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(null);
  const isProject = doc.type === 'project';
  const isActive = doc.id === state.currentDocId;
  const isSelected = selectedIds.has(doc.id);
  const isSearching = !!normalizeSearchQuery(searchQuery);
  const children = isProject
    ? childrenOf(state.documents, doc.id).filter((child) =>
        isSearching ? docOrDescendantMatches(state.documents, child.id, searchQuery) : true
      )
    : [];

  function handleClick(e) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleSelected(doc.id, true);
      return;
    }
    clearSelection();
    selectDoc(doc.id);
  }

  function handleDragStart(e) {
    const idsToMove = isSelected && selectedIds.size > 1 ? Array.from(selectedIds) : [doc.id];
    e.dataTransfer.setData('text/plain', JSON.stringify(idsToMove));
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(isProject ? 'into' : 'beside');
  }
  function handleDragLeave() {
    setDragOver(null);
  }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(null);
    let ids;
    try {
      ids = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch (err) {
      return;
    }
    if (!Array.isArray(ids) || !ids.length || ids.includes(doc.id)) return;
    const mode = isProject ? 'into' : 'beside';
    if (ids.length > 1) moveDocsRelativeBulk(ids, doc.id, mode);
    else moveDocRelative(ids[0], doc.id, mode);
  }

  return (
    <div className="doc-node">
      <div
        className={
          'doc-item' +
          (isActive ? ' active' : '') +
          (isSelected ? ' multi-selected' : '') +
          (dragOver ? ' drop-' + dragOver : '')
        }
        style={{ paddingLeft: 8 + depth * 16 }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {isProject && (
          <button
            type="button"
            className="expand-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => !x);
            }}
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
        {doc.priorityColor && <span className="priority-dot" style={{ background: doc.priorityColor }} />}
        <span className="doc-item-icon">{DOC_TYPE_ICONS[doc.type]}</span>
        <span className="doc-item-label">{doc.title || 'Без назви'}</span>
        <button
          type="button"
          className={'pin-toggle-btn' + (doc.pinned ? ' pinned' : '')}
          title={doc.pinned ? 'Відкріпити' : 'Закріпити'}
          onClick={(e) => {
            e.stopPropagation();
            togglePin(doc.id);
          }}
        >
          📌
        </button>
        <DocItemMenu doc={doc} />
      </div>

      {isProject && (isSearching || expanded) && children.length > 0 && (
        <div className="doc-children">
          {children.map((child) => (
            <DocItem
              key={child.id}
              doc={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              toggleSelected={toggleSelected}
              clearSelection={clearSelection}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
      {isProject && !isSearching && expanded && children.length === 0 && (
        <div className="doc-children">
          <div className="doc-children-empty" style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
            Порожньо
          </div>
        </div>
      )}
    </div>
  );
}

// Reorganize menu: move up/down among current siblings, move into a project,
// or move back out to the top level -- all without dragging. This is the
// only way to reorganize documents on a touch device, since native HTML5
// drag-and-drop (used by the row above for mouse users) never fires on
// mobile browsers. Also works from a keyboard, unlike drag-and-drop.
function DocItemMenu({ doc }) {
  const { state, moveSiblingDoc, moveDocToParent } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));

  const projectTargets = open ? validMoveTargets(state.documents, doc.id) : [];

  return (
    <div className="doc-item-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="doc-item-menu-btn"
        title="Дії з документом"
        aria-label="Дії з документом"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div className="doc-item-menu-dropdown">
          <button type="button" onClick={() => { moveSiblingDoc(doc.id, -1); setOpen(false); }}>
            ▲ Перемістити вище
          </button>
          <button type="button" onClick={() => { moveSiblingDoc(doc.id, 1); setOpen(false); }}>
            ▼ Перемістити нижче
          </button>
          {doc.parentId && (
            <button type="button" onClick={() => { moveDocToParent(doc.id, null); setOpen(false); }}>
              📤 На верхній рівень
            </button>
          )}
          {projectTargets.length > 0 && (
            <>
              <div className="doc-item-menu-divider" />
              <div className="doc-item-menu-label">Перемістити в проєкт:</div>
              {projectTargets.map((p) => (
                <button type="button" key={p.id} onClick={() => { moveDocToParent(doc.id, p.id); setOpen(false); }}>
                  📁 {p.title || 'Без назви'}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
