import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { StagePicker, DeadlinePicker } from './UiBits.jsx';
import { LinkInsertButton, LinkedText } from './LinkPicker.jsx';

export default function PlanEditor({ doc }) {
  const { addPlanItem, reorderPlanItems, transformPlanToNote } = useAppState();
  const [draggedItemId, setDraggedItemId] = useState(null);

  function handleDrop(targetId) {
    if (!draggedItemId || draggedItemId === targetId) return;
    const ids = doc.items.map((i) => i.id).filter((id) => id !== draggedItemId);
    const idx = ids.indexOf(targetId);
    ids.splice(idx + 1, 0, draggedItemId);
    reorderPlanItems(doc.id, ids);
    setDraggedItemId(null);
  }

  // Touch/keyboard-friendly alternative to drag-and-drop, which never fires
  // on mobile browsers: swap this item with its previous/next neighbour.
  function handleMove(itemId, direction) {
    const ids = doc.items.map((i) => i.id);
    const idx = ids.indexOf(itemId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    reorderPlanItems(doc.id, ids);
  }

  return (
    <div className="plan-editor-wrap">
      <div className="note-toolbar">
        <span className="note-toolbar-label">Перетворити на:</span>
        <button type="button" className="btn-transform-subtle" onClick={() => transformPlanToNote(doc.id)}>
          📝 Нотатка
        </button>
      </div>
      {doc.items.length === 0 ? (
        <div className="plan-empty-state">План поки що порожній. Додайте перший крок нижче.</div>
      ) : (
        <div className="plan-list">
          {doc.items.map((item, idx) => (
            <PlanRow
              key={item.id}
              item={item}
              index={idx}
              docId={doc.id}
              isFirst={idx === 0}
              isLast={idx === doc.items.length - 1}
              onDragStartRow={() => setDraggedItemId(item.id)}
              onDropRow={() => handleDrop(item.id)}
              onMoveRow={(direction) => handleMove(item.id, direction)}
            />
          ))}
        </div>
      )}
      <button type="button" className="btn-add-root" onClick={() => addPlanItem(doc.id)}>
        + Додати крок
      </button>
    </div>
  );
}

function PlanRow({ item, index, docId, isFirst, isLast, onDragStartRow, onDropRow, onMoveRow }) {
  const { updatePlanItem, deletePlanItemToTrash, focusBlockId, clearFocusBlockId } = useAppState();
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusBlockId === item.id && inputRef.current) {
      inputRef.current.focus();
      clearFocusBlockId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBlockId, item.id]);

  return (
    <div className="plan-row-wrap">
      <div
        className="plan-row"
        draggable
        onDragStart={onDragStartRow}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropRow}
      >
        <span className="drag-handle" title="Перетягнути, щоб змінити порядок">
          ⠿
        </span>
        <span className="plan-row-index">{index + 1}</span>
        <input
          ref={inputRef}
          type="text"
          className="plan-row-input"
          value={item.text}
          placeholder="Крок плану..."
          aria-label="Крок плану"
          onChange={(e) => updatePlanItem(docId, item.id, { text: e.target.value })}
        />
        <div className="row-controls">
          <LinkInsertButton
            inputRef={inputRef}
            value={item.text}
            onChange={(v) => updatePlanItem(docId, item.id, { text: v })}
            className="link-insert-btn small"
          />
          <DeadlinePicker value={item.deadline} onChange={(deadline) => updatePlanItem(docId, item.id, { deadline })} compact />
          <StagePicker value={item.stageId} onChange={(stageId) => updatePlanItem(docId, item.id, { stageId })} />
          <span className="row-move-btns">
            <button
              type="button"
              className="wbs-icon-btn move"
              title="Перемістити вище"
              aria-label="Перемістити крок вище"
              disabled={isFirst}
              onClick={() => onMoveRow(-1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="wbs-icon-btn move"
              title="Перемістити нижче"
              aria-label="Перемістити крок нижче"
              disabled={isLast}
              onClick={() => onMoveRow(1)}
            >
              ▼
            </button>
          </span>
          <button
            type="button"
            className="wbs-icon-btn delete"
            title="Видалити крок"
            aria-label="Видалити крок"
            onClick={() => deletePlanItemToTrash(docId, item.id)}
          >
            ×
          </button>
        </div>
      </div>
      <LinkedText text={item.text} className="row-link-preview" />
    </div>
  );
}
