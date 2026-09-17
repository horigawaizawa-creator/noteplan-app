import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { DeadlinePicker, PasswordPromptScreen } from './UiBits.jsx';
import { CHECKLIST_WIDTH_MIN, CHECKLIST_WIDTH_MAX, CHECKLIST_COLLAPSED_WIDTH } from '../lib/constants.js';
import { useIsMobileLayout } from '../lib/useIsMobileLayout.js';

export default function ChecklistPanel() {
  const { state, setChecklistWidth, toggleChecklistCollapsed, activePanel, goToWorkspacePanel, unlockedDocIds, unlockDoc } = useAppState();
  const doc = state.currentDocId ? state.documents[state.currentDocId] : null;
  const { checklistWidth, checklistCollapsed } = state.ui;
  const isMobileLayout = useIsMobileLayout();
  const isLocked = !!(doc && doc.lockPassword && !unlockedDocIds.has(doc.id));
  // In the mobile single-pane layout the checklist is either the full-screen
  // active panel or not visible at all -- the desktop "collapsed to a thin
  // strip" preference doesn't apply there, so ignore it while this is the
  // active mobile panel.
  const forceExpanded = isMobileLayout && activePanel === 'checklist';

  const [liveWidth, setLiveWidth] = useState(checklistWidth);
  const liveWidthRef = useRef(checklistWidth);
  const resizingRef = useRef(false);

  useEffect(() => {
    if (!resizingRef.current) {
      setLiveWidth(checklistWidth);
      liveWidthRef.current = checklistWidth;
    }
  }, [checklistWidth]);

  // Pointer Events unify mouse, touch, and pen in one set of handlers (unlike
  // the old mousedown/mousemove/mouseup trio, which never fired for touch).
  // setPointerCapture routes subsequent events straight to this element, so
  // there's no need to attach/detach listeners on `document` by hand.
  function handleResizeStart(e) {
    e.preventDefault();
    resizingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }
  function handleResizeMove(e) {
    if (!resizingRef.current) return;
    const newWidth = Math.min(CHECKLIST_WIDTH_MAX, Math.max(CHECKLIST_WIDTH_MIN, window.innerWidth - e.clientX));
    liveWidthRef.current = newWidth;
    setLiveWidth(newWidth);
  }
  function handleResizeEnd(e) {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setChecklistWidth(liveWidthRef.current);
  }

  if (checklistCollapsed && !forceExpanded) {
    return (
      <aside className="checklist-panel collapsed" style={isMobileLayout ? undefined : { width: CHECKLIST_COLLAPSED_WIDTH }}>
        <button type="button" className="checklist-expand-btn" title="Показати чек-лист" onClick={toggleChecklistCollapsed}>
          ◀<br />✅
        </button>
      </aside>
    );
  }

  return (
    <aside className="checklist-panel" style={isMobileLayout ? undefined : { width: liveWidth }}>
      <div
        className="checklist-resize-handle"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        title="Перетягніть, щоб змінити розмір"
      />
      <div className="checklist-header">
        <button type="button" className="checklist-back-btn" onClick={goToWorkspacePanel} aria-label="Назад до документа">
          ← Назад
        </button>
        <h2>✅ Чек-лист</h2>
        <button type="button" className="checklist-collapse-btn" title="Приховати чек-лист" onClick={toggleChecklistCollapsed}>
          ▶
        </button>
      </div>
      {!doc ? (
        <div className="checklist-empty">Відкрийте документ, щоб побачити його чек-лист.</div>
      ) : isLocked ? (
        <PasswordPromptScreen
          title={'🔒 «' + (doc.title || 'Без назви') + '» заблоковано'}
          onUnlock={(pwd) => unlockDoc(doc.id, pwd)}
        />
      ) : (
        <ChecklistBody doc={doc} />
      )}
    </aside>
  );
}

function ChecklistBody({ doc }) {
  const { addChecklistItem, toggleChecklistItem, updateChecklistItem, deleteChecklistItemToTrash } = useAppState();
  const [newText, setNewText] = useState('');

  const total = doc.checklist.length;
  const done = doc.checklist.filter((i) => i.checked).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  function handleSubmit() {
    const text = newText.trim();
    if (!text) return;
    addChecklistItem(doc.id, text);
    setNewText('');
  }

  return (
    <>
      <div className="progress-container">
        <div className="progress-label">{total ? done + ' з ' + total + ' виконано (' + pct + '%)' : 'Немає задач'}</div>
        <div className="progress-bar-outer">
          <div className="progress-bar-inner" style={{ width: pct + '%' }} />
        </div>
      </div>

      <div className="add-checklist-form">
        <input
          className="add-checklist-input"
          value={newText}
          placeholder="Нова задача..."
          aria-label="Нова задача"
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button type="button" className="add-checklist-btn" onClick={handleSubmit}>
          + Додати
        </button>
      </div>

      <div className="checklist-list">
        {doc.checklist.length === 0 ? (
          <div className="checklist-empty">Задач ще немає. Додайте першу вище.</div>
        ) : (
          doc.checklist.map((item) => (
            <div key={item.id} className={'checklist-item' + (item.checked ? ' checked' : '')}>
              <input
                type="checkbox"
                className="checklist-checkbox"
                checked={item.checked}
                aria-label="Позначити задачу виконаною"
                onChange={() => toggleChecklistItem(doc.id, item.id)}
              />
              <input
                type="text"
                className="checklist-text-input"
                value={item.text}
                aria-label="Текст задачі"
                onChange={(e) => updateChecklistItem(doc.id, item.id, { text: e.target.value })}
              />
              <DeadlinePicker value={item.deadline} onChange={(deadline) => updateChecklistItem(doc.id, item.id, { deadline })} compact />
              <button
                type="button"
                className="checklist-delete-btn"
                title="Видалити задачу"
                aria-label="Видалити задачу"
                onClick={() => deleteChecklistItemToTrash(doc.id, item.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
