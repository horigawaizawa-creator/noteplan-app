import React from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { DOC_TYPE_ICONS } from '../lib/constants.js';
import { computeBacklinks } from '../lib/links.js';

export default function BacklinksPanel({ docId, subId }) {
  const { state, selectDoc } = useAppState();
  const backlinks = computeBacklinks(state.documents, docId, subId);
  if (!backlinks.length) return null;

  return (
    <div className="backlinks-panel">
      <div className="backlinks-heading">🔗 Зворотні посилання ({backlinks.length})</div>
      <div className="backlinks-list">
        {backlinks.map((b, i) => (
          <button type="button" key={i} className="backlink-item" onClick={() => selectDoc(b.docId)}>
            <span>{DOC_TYPE_ICONS[b.docType]}</span>
            <span className="backlink-title">{b.docTitle}</span>
            <span className="backlink-context">— {b.context}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
