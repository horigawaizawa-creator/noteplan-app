import React, { useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { DOC_TYPE_ICONS } from '../lib/constants.js';
import { renderLinkParts } from '../lib/links.js';

function subItemsOf(doc) {
  if (!doc) return [];
  if (doc.type === 'plan') return (doc.items || []).map((i) => ({ id: i.id, label: i.text || 'Без назви' }));
  if (doc.type === 'wbs') {
    const flat = [];
    function walk(blocks) {
      blocks.forEach((b) => {
        flat.push({ id: b.id, label: b.text || 'Без назви' });
        walk(b.children || []);
      });
    }
    walk(doc.blocks || []);
    return flat;
  }
  return (doc.checklist || []).map((i) => ({ id: i.id, label: '✓ ' + (i.text || 'Без назви') }));
}

function LinkPickerModal({ onClose, onInsert }) {
  const { state } = useAppState();
  const [query, setQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);

  const filteredDocs = Object.values(state.documents).filter((d) =>
    (d.title || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal link-picker-modal">
        <div className="settings-header">
          <h2>🔗 Вставити посилання</h2>
          <button type="button" className="modal-close-btn" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
        </div>

        {!selectedDoc ? (
          <>
            <input
              className="stage-add-input"
              autoFocus
              placeholder="Пошук документа..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="link-picker-list">
              {filteredDocs.map((d) => (
                <button type="button" key={d.id} className="link-picker-row" onClick={() => setSelectedDoc(d)}>
                  {DOC_TYPE_ICONS[d.type]} {d.title || 'Без назви'}
                </button>
              ))}
              {filteredDocs.length === 0 && <div className="doc-section-empty">Нічого не знайдено</div>}
            </div>
          </>
        ) : (
          <>
            <div className="link-picker-breadcrumb">
              <button type="button" className="btn-secondary" onClick={() => setSelectedDoc(null)}>
                ← Назад
              </button>
              <span>
                {DOC_TYPE_ICONS[selectedDoc.type]} {selectedDoc.title || 'Без назви'}
              </span>
            </div>
            <button
              type="button"
              className="link-picker-row whole-doc"
              onClick={() => {
                onInsert('[[' + selectedDoc.id + ']]');
                onClose();
              }}
            >
              🔗 Посилання на весь документ
            </button>
            {subItemsOf(selectedDoc).length > 0 && (
              <div className="link-picker-list">
                {subItemsOf(selectedDoc).map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className="link-picker-row"
                    onClick={() => {
                      onInsert('[[' + selectedDoc.id + '::' + s.id + ']]');
                      onClose();
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Small 🔗 button that opens the picker and splices the chosen link token
// into `value` at the current cursor position of the given input/textarea ref.
export function LinkInsertButton({ inputRef, value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const savedSelection = useRef({ start: value.length, end: value.length });

  function openPicker() {
    if (inputRef.current) {
      savedSelection.current = {
        start: inputRef.current.selectionStart ?? value.length,
        end: inputRef.current.selectionEnd ?? value.length,
      };
    }
    setOpen(true);
  }

  function handleInsert(token) {
    const { start, end } = savedSelection.current;
    const newValue = value.slice(0, start) + token + value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = start + token.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <>
      <button type="button" className={className || 'link-insert-btn'} title="Вставити посилання" onClick={openPicker}>
        🔗
      </button>
      {open && <LinkPickerModal onClose={() => setOpen(false)} onInsert={handleInsert} />}
    </>
  );
}

// Renders text with [[id]] / [[id::subId]] tokens as clickable pills.
export function LinkedText({ text, className }) {
  const { state, selectDoc } = useAppState();
  if (!text) return null;
  const parts = renderLinkParts(state.documents, text);
  const hasLinks = parts.some((p) => p.type === 'link');
  if (!hasLinks) return null;
  return (
    <span className={className || 'linked-text'}>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <React.Fragment key={i}>{p.value}</React.Fragment>
        ) : (
          <button
            type="button"
            key={i}
            className={'inline-link-pill' + (p.ok ? '' : ' broken')}
            onClick={() => selectDoc(p.docId)}
          >
            🔗 {p.label}
          </button>
        )
      )}
    </span>
  );
}
