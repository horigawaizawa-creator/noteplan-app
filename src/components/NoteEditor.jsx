import React, { useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { LinkInsertButton } from './LinkPicker.jsx';
import { NoteAppearancePicker } from './UiBits.jsx';
import { renderLinkParts } from '../lib/links.js';
import { NOTE_BG_COLORS } from '../lib/constants.js';

export default function NoteEditor({ doc }) {
  const { state, updateDoc, transformNoteToWbs, transformNoteToPlan, selectDoc } = useAppState();
  const [preview, setPreview] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const textareaRef = useRef(null);

  const parts = preview ? renderLinkParts(state.documents, doc.content || '') : null;
  const bgEntry = NOTE_BG_COLORS.find((c) => c.key === doc.bgColorKey);
  const pattern = doc.paperPattern || (doc.ruled ? 'lined' : 'none');
  // All the custom backgrounds are light/pastel, so a light background
  // always pairs with dark text and dark ruled lines; the default (no
  // custom color) keeps the app's normal light-on-dark look.
  const wrapStyle = bgEntry ? { backgroundColor: bgEntry.bg, color: bgEntry.text } : undefined;

  return (
    <div className="note-editor-wrap" style={wrapStyle}>
      <div className="note-toolbar">
        <button
          type="button"
          className="note-transform-toggle-btn"
          title="Перетворити на..."
          aria-label="Перетворити на..."
          aria-expanded={transformOpen}
          onClick={() => setTransformOpen((o) => !o)}
        >
          ⇄
        </button>
        <div className={'note-transform-options' + (transformOpen ? ' open' : '')}>
          <span className="note-toolbar-label">Перетворити на:</span>
          <button type="button" className="btn-transform-subtle" onClick={() => transformNoteToPlan(doc.id)}>
            📋 План
          </button>
          <button type="button" className="btn-transform-subtle" onClick={() => transformNoteToWbs(doc.id)}>
            🗂️ WBS
          </button>
        </div>
        <NoteAppearancePicker doc={doc} />
        <div className="note-toolbar-spacer" />
        <LinkInsertButton
          inputRef={textareaRef}
          value={doc.content || ''}
          onChange={(v) => updateDoc(doc.id, { content: v })}
        />
        <button type="button" className={'btn-transform-subtle' + (preview ? ' active' : '')} onClick={() => setPreview((p) => !p)}>
          {preview ? '✏️ Редагувати' : '👁 Перегляд'}
        </button>
      </div>

      {preview ? (
        <div className="note-preview" style={wrapStyle}>
          {parts && parts.length > 0 ? (
            parts.map((p, i) =>
              p.type === 'text' ? (
                <React.Fragment key={i}>{p.value}</React.Fragment>
              ) : (
                <button type="button" key={i} className={'inline-link-pill' + (p.ok ? '' : ' broken')} onClick={() => selectDoc(p.docId)}>
                  🔗 {p.label}
                </button>
              )
            )
          ) : (
            <span className="text-faint-italic">Порожньо</span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className={'note-textarea' + (pattern !== 'none' ? ' pattern-' + pattern : '') + (bgEntry ? ' on-light' : '')}
          style={wrapStyle}
          value={doc.content || ''}
          placeholder="Почніть писати..."
          aria-label="Текст нотатки"
          onChange={(e) => updateDoc(doc.id, { content: e.target.value })}
        />
      )}
    </div>
  );
}
