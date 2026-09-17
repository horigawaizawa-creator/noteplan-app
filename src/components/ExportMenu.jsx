import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { useOutsideClick } from './UiBits.jsx';
import { exportNodeAsImage, exportNodeAsStyledPdf, printPlainTextDocument, exportDocAsTextPdf } from '../lib/export.js';

function safeFilename(title) {
  return (title || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

export default function ExportMenu({ doc }) {
  const { showToast } = useAppState();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));

  async function run(fn, label) {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      showToast('Не вдалося експортувати: ' + label, { isError: true });
    } finally {
      setBusy(false);
    }
  }

  function handleStyledPdf() {
    const node = document.getElementById('workspace-capture-root');
    return run(() => exportNodeAsStyledPdf(node, safeFilename(doc.title) + '.pdf'), 'PDF як на екрані');
  }
  function handleImage() {
    const node = document.getElementById('workspace-capture-root');
    return run(() => exportNodeAsImage(node, safeFilename(doc.title) + '.png'), 'зображення');
  }
  function handleTextPdf() {
    return run(() => exportDocAsTextPdf(doc, safeFilename(doc.title) + '.pdf'), 'PDF з текстом');
  }
  function handlePlainPdf() {
    setOpen(false);
    try {
      printPlainTextDocument(doc);
    } catch (e) {
      console.error(e);
      showToast('Не вдалося підготувати друк: текстовий PDF', { isError: true });
    }
  }

  return (
    <div className="export-menu" ref={ref}>
      <button type="button" className="btn-export" onClick={() => setOpen((o) => !o)} disabled={busy}>
        {busy ? '⏳ Експорт...' : '⬇ Експорт'}
      </button>
      {open && (
        <div className="create-menu-dropdown export-dropdown">
          <button type="button" onClick={handleTextPdf}>
            📝 PDF з текстом (завантажити)
          </button>
          <button type="button" onClick={handleStyledPdf}>
            🎨 PDF (як на екрані)
          </button>
          <button type="button" onClick={handleImage}>
            🖼️ Зображення (PNG)
          </button>
          <button type="button" onClick={handlePlainPdf}>
            📄 PDF (простий текст, друк)
          </button>
        </div>
      )}
    </div>
  );
}
