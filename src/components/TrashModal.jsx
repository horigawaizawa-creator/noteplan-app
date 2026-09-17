import React from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { DOC_TYPE_ICONS } from '../lib/constants.js';
import { formatDate } from '../lib/docs.js';

const KIND_ICONS = {
  doc: null, // resolved from docType
  wbsBlock: '🗂️',
  planItem: '📋',
  checklistItem: '✅',
};
const KIND_LABELS = {
  doc: 'документ',
  wbsBlock: 'блок WBS',
  planItem: 'крок плану',
  checklistItem: 'задача чек-листа',
};

export default function TrashModal({ onClose }) {
  const { state, restoreTrashEntry, purgeTrashEntry, emptyTrash } = useAppState();
  const trash = state.trash;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal settings-modal">
        <div className="settings-header">
          <h2>🗑 Кошик</h2>
          <button type="button" className="modal-close-btn" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="settings-hint">
          Видалені документи, блоки, кроки та задачі потрапляють сюди. Відновіть їх, або видаліть назавжди.
        </p>

        {trash.length === 0 ? (
          <div className="doc-section-empty">Кошик порожній.</div>
        ) : (
          <>
            <div className="trash-list">
              {trash.map((t) => (
                <div key={t.id} className="trash-row">
                  <span className="trash-icon">{t.kind === 'doc' ? DOC_TYPE_ICONS[t.docType] : KIND_ICONS[t.kind]}</span>
                  <div className="trash-info">
                    <span className="trash-label">{t.label}</span>
                    <span className="trash-meta">{KIND_LABELS[t.kind]} · видалено {formatDate(t.deletedAt)}</span>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => restoreTrashEntry(t.id)}>
                    ↩ Відновити
                  </button>
                  <button type="button" className="wbs-icon-btn delete" title="Видалити назавжди" onClick={() => purgeTrashEntry(t.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="stage-add-row">
              <button type="button" className="btn-danger" onClick={emptyTrash}>
                Очистити кошик назавжди
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
