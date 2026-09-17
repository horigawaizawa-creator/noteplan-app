import React from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { StageBadgeReadOnly } from './UiBits.jsx';
import { DOC_TYPE_ICONS } from '../lib/constants.js';
import { childrenOf } from '../lib/docs.js';

export default function ProjectEditor({ doc }) {
  const { state, updateDoc, createDoc, selectDoc } = useAppState();
  const children = childrenOf(state.documents, doc.id);

  return (
    <div className="project-editor-wrap">
      <textarea
        className="project-description"
        value={doc.content || ''}
        placeholder="Опис проєкту (необов'язково)..."
        aria-label="Опис проєкту"
        onChange={(e) => updateDoc(doc.id, { content: e.target.value })}
      />

      <div className="project-quick-create">
        <button type="button" onClick={() => createDoc('note', doc.id)}>
          📝 + Нотатка
        </button>
        <button type="button" onClick={() => createDoc('plan', doc.id)}>
          📋 + План
        </button>
        <button type="button" onClick={() => createDoc('wbs', doc.id)}>
          🗂️ + WBS План
        </button>
      </div>

      <div className="project-children">
        <div className="project-children-heading">Вміст проєкту ({children.length})</div>
        {children.length === 0 ? (
          <div className="project-children-empty">У цьому проєкті ще немає документів.</div>
        ) : (
          <div className="project-children-list">
            {children.map((c) => (
              <div key={c.id} className="project-child-item" onClick={() => selectDoc(c.id)}>
                {c.priorityColor && <span className="priority-dot" style={{ background: c.priorityColor }} />}
                <span>{DOC_TYPE_ICONS[c.type]}</span>
                <span className="project-child-title">{c.title || 'Без назви'}</span>
                {c.stageId && <StageBadgeReadOnly stageId={c.stageId} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
