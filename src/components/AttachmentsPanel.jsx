import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { getFileBlob } from '../lib/storage.js';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

// Friendly file-type label shown under the name, so it's clear what kind of
// file it is without having to open it first.
function fileTypeLabel(mime) {
  if (!mime) return 'Файл';
  if (mime.startsWith('image/')) return 'Зображення';
  if (mime.startsWith('video/')) return 'Відео';
  if (mime.startsWith('audio/')) return 'Аудіо';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('text/')) return 'Текст';
  if (mime.includes('word')) return 'Документ Word';
  if (mime.includes('sheet') || mime.includes('excel')) return 'Таблиця';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Презентація';
  if (mime.includes('zip') || mime.includes('compressed')) return 'Архів';
  return 'Файл';
}

export default function AttachmentsPanel({ doc, hideHeader }) {
  const { addAttachment, deleteAttachment } = useAppState();
  const inputRef = useRef(null);
  const attachments = doc.attachments || [];
  const [lightbox, setLightbox] = useState(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addAttachment(doc.id, file);
    }
    e.target.value = '';
  }

  return (
    <div className="attachments-panel">
      <div className="attachments-header">
        {!hideHeader && <span className="attachments-title">📎 Файли та фото ({attachments.length})</span>}
        <button type="button" className={'btn-transform-subtle' + (hideHeader ? ' full-width' : '')} onClick={() => inputRef.current?.click()}>
          + Додати файл
        </button>
        <input ref={inputRef} type="file" multiple hidden onChange={handleFiles} />
      </div>
      {attachments.length > 0 ? (
        <div className="attachments-grid">
          {attachments.map((a) => (
            <AttachmentItem
              key={a.id}
              attachment={a}
              onDelete={() => deleteAttachment(doc.id, a.id)}
              onPreview={(url) => setLightbox({ url, name: a.name })}
            />
          ))}
        </div>
      ) : (
        hideHeader && <div className="doc-section-empty">Файлів ще немає.</div>
      )}
      {lightbox && <AttachmentLightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// Reachable from the document header's "..." menu -- keeps the always-visible
// note body free of the attachments grid, showing it only on demand.
export function AttachmentsModal({ doc, onClose }) {
  const attachments = doc.attachments || [];
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal attachments-modal-shell">
        <div className="settings-header">
          <h2>📎 Додані файли ({attachments.length})</h2>
          <button type="button" className="modal-close-btn" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
        </div>
        <AttachmentsPanel doc={doc} hideHeader />
      </div>
    </div>
  );
}

function AttachmentItem({ attachment, onDelete, onPreview }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    getFileBlob(attachment.id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  const isImage = (attachment.mime || '').startsWith('image/');

  return (
    <div className="attachment-item">
      {isImage && url ? (
        <button type="button" className="attachment-thumb" onClick={() => onPreview(url)} aria-label={'Переглянути ' + attachment.name}>
          <img src={url} alt={attachment.name} />
        </button>
      ) : (
        // Opens in a new tab instead of forcing a download -- most browsers
        // render PDFs, text, and other common types inline; anything they
        // can't display falls back to their own download behaviour anyway.
        <a href={url || undefined} target="_blank" rel="noopener noreferrer" className="attachment-thumb attachment-file-icon">
          📄
        </a>
      )}
      <div className="attachment-meta">
        <span className="attachment-name" title={attachment.name}>
          {attachment.name}
        </span>
        <span className="attachment-size">
          {fileTypeLabel(attachment.mime)} · {formatSize(attachment.size || 0)}
        </span>
      </div>
      <button type="button" className="wbs-icon-btn delete" title="Видалити файл" aria-label="Видалити файл" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}

function AttachmentLightbox({ url, name, onClose }) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal attachment-lightbox-modal">
        <div className="settings-header">
          <h2 title={name}>{name}</h2>
          <div className="attachment-lightbox-actions">
            <a href={url} download={name} className="wbs-icon-btn" title="Завантажити файл" aria-label="Завантажити файл">
              ⬇
            </a>
            <button type="button" className="modal-close-btn" aria-label="Закрити" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <img src={url} alt={name} className="attachment-lightbox-img" />
      </div>
    </div>
  );
}
