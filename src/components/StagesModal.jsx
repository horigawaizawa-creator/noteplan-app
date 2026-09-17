import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { LABEL_COLORS } from '../lib/constants.js';

export default function StagesModal({ onClose }) {
  const { state, addStage, updateStage, deleteStage } = useAppState();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0].hex);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addStage(name, newColor);
    setNewName('');
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal settings-modal">
        <div className="settings-header">
          <h2>📊 Стадії розробки</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Закрити">
            ×
          </button>
        </div>
        <p className="settings-hint">
          Стадії показують прогрес документів, кроків плану та блоків WBS. Створюйте власні — назва + колір.
        </p>

        <div className="stage-list">
          {state.stages.length === 0 && <div className="doc-section-empty">Стадій ще немає.</div>}
          {state.stages.map((s) => (
            <StageRow key={s.id} stage={s} onUpdate={(patch) => updateStage(s.id, patch)} onDelete={() => deleteStage(s.id)} />
          ))}
        </div>

        <div className="stage-add-row">
          <input
            className="stage-add-input"
            value={newName}
            placeholder="Назва нової стадії..."
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <div className="stage-color-swatches">
            {LABEL_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={'swatch-mini' + (newColor === c.hex ? ' selected' : '')}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => setNewColor(c.hex)}
              />
            ))}
          </div>
          <button type="button" className="btn-transform" onClick={handleAdd}>
            + Додати
          </button>
        </div>
      </div>
    </div>
  );
}

function StageRow({ stage, onUpdate, onDelete }) {
  return (
    <div className="stage-row">
      <span className="stage-dot" style={{ background: stage.color }} />
      <input className="stage-name-input" value={stage.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      <div className="stage-color-swatches small">
        {LABEL_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={'swatch-mini' + (stage.color === c.hex ? ' selected' : '')}
            style={{ background: c.hex }}
            title={c.name}
            onClick={() => onUpdate({ color: c.hex })}
          />
        ))}
      </div>
      <button type="button" className="wbs-icon-btn delete" title="Видалити стадію" aria-label="Видалити стадію" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}
