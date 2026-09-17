import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { PriorityColorPicker, StagePicker, DeadlinePicker, PasswordPromptScreen, SetPasswordModal } from './UiBits.jsx';
import { DOC_TYPE_ICONS, DOC_TYPE_LABELS } from '../lib/constants.js';
import { formatDate } from '../lib/docs.js';
import NoteEditor from './NoteEditor.jsx';
import PlanEditor from './PlanEditor.jsx';
import WbsEditor from './WbsEditor.jsx';
import ProjectEditor from './ProjectEditor.jsx';
import { AttachmentsModal } from './AttachmentsPanel.jsx';
import BacklinksPanel from './BacklinksPanel.jsx';
import ExportMenu from './ExportMenu.jsx';

export default function Workspace() {
  const { state, goToSidebarPanel, unlockedDocIds, unlockDoc } = useAppState();
  const doc = state.currentDocId ? state.documents[state.currentDocId] : null;

  if (!doc) return <EmptyWorkspace onBack={goToSidebarPanel} />;

  const isLocked = !!doc.lockPassword && !unlockedDocIds.has(doc.id);

  return (
    <main className="workspace">
      <WorkspaceHeader doc={doc} isLocked={isLocked} />
      {isLocked ? (
        <PasswordPromptScreen
          title={'🔒 «' + (doc.title || 'Без назви') + '» заблоковано'}
          onUnlock={(pwd) => unlockDoc(doc.id, pwd)}
        />
      ) : (
        <div className="workspace-body" id="workspace-capture-root">
          {doc.type === 'note' && <NoteEditor doc={doc} />}
          {doc.type === 'plan' && <PlanEditor doc={doc} />}
          {doc.type === 'wbs' && <WbsEditor doc={doc} />}
          {doc.type === 'project' && <ProjectEditor doc={doc} />}
          <BacklinksPanel docId={doc.id} subId={null} />
        </div>
      )}
    </main>
  );
}

function EmptyWorkspace({ onBack }) {
  return (
    <main className="workspace">
      {onBack && (
        <button type="button" className="workspace-back-btn standalone" onClick={onBack} aria-label="Назад до списку документів">
          ← Назад
        </button>
      )}
      <div className="workspace-empty">
        <div className="workspace-empty-icon">🧭</div>
        <h2>Немає відкритого документа</h2>
        <p>Виберіть документ зліва, або натисніть «+ Створити», щоб почати новий.</p>
      </div>
    </main>
  );
}

function WorkspaceHeader({ doc, isLocked }) {
  const {
    updateDoc,
    deleteDocToTrash,
    togglePin,
    justCreatedId,
    clearJustCreatedId,
    goToSidebarPanel,
    goToChecklistPanel,
    setDocLockPassword,
    lockDocNow,
  } = useAppState();
  const titleRef = useRef(null);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  // Collapses the priority/stage/deadline/pin/export/delete controls behind
  // "..." so the mobile header stays to one compact line -- on desktop this
  // section is always shown regardless of this state (see the CSS), so
  // desktop behaviour is unchanged.
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (justCreatedId === doc.id && titleRef.current) {
      const el = titleRef.current;
      el.focus();
      // On mobile, focus() kicks off async work (opening the keyboard,
      // scrolling the field into view) that can reset a select() called in
      // the same tick, leaving the old title in place and forcing you to
      // delete it by hand. Running select() on the next frame fixes it.
      requestAnimationFrame(() => el.select());
      clearJustCreatedId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreatedId, doc.id]);

  // Don't carry an open "..." panel or modal over when the user switches documents.
  useEffect(() => {
    setDetailsOpen(false);
    setPwdModalOpen(false);
    setAttachmentsOpen(false);
  }, [doc.id]);

  return (
    <div className="workspace-header">
      <div className="workspace-header-top">
        <button type="button" className="workspace-back-btn" onClick={goToSidebarPanel} aria-label="Назад до списку документів">
          ←
        </button>
        <span className={'doc-type-badge ' + doc.type} title={DOC_TYPE_LABELS[doc.type]} aria-label={DOC_TYPE_LABELS[doc.type]}>
          <span className="doc-type-badge-icon">{DOC_TYPE_ICONS[doc.type]}</span>
        </span>
        <input
          ref={titleRef}
          type="text"
          className="doc-title-input"
          value={doc.title}
          placeholder="Назва документа..."
          aria-label="Назва документа"
          readOnly={isLocked}
          onChange={(e) => updateDoc(doc.id, { title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) updateDoc(doc.id, { title: 'Без назви' });
          }}
        />
        {!isLocked && (
          <button type="button" className="workspace-checklist-btn" onClick={goToChecklistPanel} aria-label="Відкрити чек-лист">
            ✅
          </button>
        )}
        <button
          type="button"
          className="workspace-more-btn"
          aria-label="Ще дії з документом"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((o) => !o)}
        >
          ⋯
        </button>
      </div>
      <div className={'workspace-header-details' + (detailsOpen ? ' open' : '')}>
        {isLocked ? (
          <>
            <span className="locked-notice">🔒 Заблоковано — розблокуйте, щоб отримати доступ до дій</span>
            <button type="button" className="btn-delete-doc" onClick={() => deleteDocToTrash(doc.id)}>
              🗑 Видалити документ
            </button>
          </>
        ) : (
          <>
            <PriorityColorPicker doc={doc} />
            <StagePicker value={doc.stageId} onChange={(stageId) => updateDoc(doc.id, { stageId })} />
            <DeadlinePicker value={doc.deadline} onChange={(deadline) => updateDoc(doc.id, { deadline })} />
            <button
              type="button"
              className={'pin-btn' + (doc.pinned ? ' pinned' : '')}
              title={doc.pinned ? 'Відкріпити' : 'Закріпити'}
              onClick={() => togglePin(doc.id)}
            >
              📌
            </button>
            <ExportMenu doc={doc} />
            <button type="button" className="btn-transform-subtle" onClick={() => setAttachmentsOpen(true)}>
              📎 Додані файли ({(doc.attachments || []).length})
            </button>
            <button type="button" className="btn-transform-subtle" onClick={() => setPwdModalOpen(true)}>
              {doc.lockPassword ? '🔒 Пароль: змінити' : '🔒 Захистити паролем'}
            </button>
            {doc.lockPassword && (
              <button
                type="button"
                className="wbs-icon-btn lock-now-btn"
                title="Заблокувати документ зараз"
                aria-label="Заблокувати документ зараз"
                onClick={() => lockDocNow(doc.id)}
              >
                🔐
              </button>
            )}
            <button type="button" className="btn-delete-doc" onClick={() => deleteDocToTrash(doc.id)}>
              🗑 Видалити документ
            </button>
          </>
        )}
      </div>
      <div className="workspace-header-meta">Оновлено: {formatDate(doc.updatedAt)}</div>
      {pwdModalOpen && !isLocked && (
        <SetPasswordModal
          title={doc.lockPassword ? 'Змінити пароль документа' : 'Захистити документ паролем'}
          isSet={!!doc.lockPassword}
          onSave={(pwd) => setDocLockPassword(doc.id, pwd)}
          onRemove={() => setDocLockPassword(doc.id, null)}
          onClose={() => setPwdModalOpen(false)}
        />
      )}
      {attachmentsOpen && !isLocked && <AttachmentsModal doc={doc} onClose={() => setAttachmentsOpen(false)} />}
    </div>
  );
}
