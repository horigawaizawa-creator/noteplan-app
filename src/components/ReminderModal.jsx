import React from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { DOC_TYPE_ICONS, DEADLINE_STATUS_LABELS } from '../lib/constants.js';
import { formatDeadline } from '../lib/docs.js';

export default function ReminderModal({ items, onClose }) {
  const { selectDoc } = useAppState();

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal settings-modal">
        <div className="settings-header">
          <h2>📅 Сьогодні і прострочено</h2>
          <button type="button" className="modal-close-btn" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="settings-hint">Ось усе, що горить сьогодні або вже прострочено.</p>

        <div className="reminder-list">
          {items.map((it, i) => (
            <button
              type="button"
              key={i}
              className={'reminder-row status-' + it.status}
              onClick={() => {
                selectDoc(it.docId);
                onClose();
              }}
            >
              <span className="reminder-icon">{DOC_TYPE_ICONS[it.docType]}</span>
              <div className="reminder-info">
                <span className="reminder-label">{it.label}</span>
                <span className="reminder-meta">
                  {it.isDocLevel ? 'документ' : 'у «' + it.docTitle + '»'} · {DEADLINE_STATUS_LABELS[it.status]} ({formatDeadline(it.deadline)})
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="stage-add-row">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
