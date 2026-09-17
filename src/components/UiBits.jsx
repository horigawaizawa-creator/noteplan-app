import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { LABEL_COLORS, NOTE_BG_COLORS, PAPER_PATTERNS } from '../lib/constants.js';
import { deadlineStatus, formatDeadline } from '../lib/docs.js';

export function useOutsideClick(handler) {
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) handler();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [handler]);
  return ref;
}

export function PriorityColorPicker({ doc }) {
  const { updateDoc } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));

  return (
    <div className="color-picker" ref={ref}>
      <button
        type="button"
        className="color-picker-trigger"
        title="Пріоритет"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="color-dot"
          style={
            doc.priorityColor
              ? { background: doc.priorityColor }
              : { background: 'transparent', border: '1.5px dashed var(--text-faint)' }
          }
        />
      </button>
      {open && (
        <div className="color-picker-dropdown">
          <button
            type="button"
            className="color-swatch none"
            title="Без кольору"
            onClick={() => {
              updateDoc(doc.id, { priorityColor: null });
              setOpen(false);
            }}
          >
            ✕
          </button>
          {LABEL_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              className="color-swatch"
              style={{ background: c.hex }}
              title={c.name}
              onClick={() => {
                updateDoc(doc.id, { priorityColor: c.hex });
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteAppearancePicker({ doc }) {
  const { updateDoc } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));
  const current = NOTE_BG_COLORS.find((c) => c.key === doc.bgColorKey);
  // Backward compatible with docs saved before the pattern picker existed,
  // when there was only a boolean "ruled paper" toggle.
  const pattern = doc.paperPattern || (doc.ruled ? 'lined' : 'none');

  return (
    <div className="color-picker note-appearance-picker" ref={ref}>
      <button
        type="button"
        className="color-picker-trigger"
        title="Вигляд нотатки"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="color-dot"
          style={
            current
              ? { background: current.bg, border: '1.5px solid rgba(0,0,0,0.25)' }
              : { background: 'transparent', border: '1.5px dashed var(--text-faint)' }
          }
        />
      </button>
      {open && (
        <div className="color-picker-dropdown note-appearance-dropdown">
          <div className="note-appearance-label">Колір фону</div>
          <div className="note-appearance-swatches">
            <button
              type="button"
              className="color-swatch none"
              title="Без кольору"
              onClick={() => updateDoc(doc.id, { bgColorKey: null })}
            >
              ✕
            </button>
            {NOTE_BG_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={'color-swatch' + (doc.bgColorKey === c.key ? ' selected' : '')}
                style={{ background: c.bg }}
                title={c.name}
                onClick={() => updateDoc(doc.id, { bgColorKey: c.key })}
              />
            ))}
          </div>
          <div className="note-appearance-label">Тип паперу</div>
          <div className="paper-pattern-options">
            {PAPER_PATTERNS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={'paper-pattern-btn' + (pattern === p.key ? ' active' : '')}
                onClick={() => updateDoc(doc.id, { paperPattern: p.key, ruled: undefined })}
              >
                <span className={'paper-pattern-preview pattern-' + p.key} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StagePicker({ value, onChange }) {
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));
  const stage = state.stages.find((s) => s.id === value);

  return (
    <div className="stage-picker" ref={ref}>
      <button
        type="button"
        className="stage-picker-trigger"
        style={stage ? { borderColor: stage.color, color: stage.color } : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {stage ? stage.name : 'Стадія'}
      </button>
      {open && (
        <div className="stage-picker-dropdown">
          <button
            type="button"
            className="stage-picker-option"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Без стадії
          </button>
          {state.stages.map((s) => (
            <button
              type="button"
              key={s.id}
              className="stage-picker-option"
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
            >
              <span className="stage-dot" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StageBadgeReadOnly({ stageId }) {
  const { state } = useAppState();
  const stage = state.stages.find((s) => s.id === stageId);
  if (!stage) return null;
  return (
    <span className="stage-badge-ro" style={{ color: stage.color, borderColor: stage.color }}>
      {stage.name}
    </span>
  );
}

export function DeadlinePicker({ value, onChange, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick(() => setOpen(false));
  const status = deadlineStatus(value);

  return (
    <div className="deadline-picker" ref={ref}>
      <button
        type="button"
        className={'deadline-trigger' + (status ? ' status-' + status : '') + (compact ? ' compact' : '')}
        title="Термін виконання"
        onClick={() => setOpen((o) => !o)}
      >
        📅 {value ? formatDeadline(value) : compact ? '' : 'Термін'}
      </button>
      {open && (
        <div className="deadline-dropdown">
          <input
            type="date"
            className="deadline-date-input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
          {value && (
            <button
              type="button"
              className="deadline-clear-btn"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Прибрати термін
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ToastHost() {
  const { toasts, dismissToast } = useAppState();
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={'toast' + (t.isError ? ' toast-error' : '')}>
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="toast-action-btn"
              onClick={() => {
                t.action.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Full-screen "enter password" prompt. This is a privacy screen, not real
// encryption -- it just keeps the content off screen until the password is
// typed again; onUnlock does a plain-text comparison against what was set.
export function PasswordPromptScreen({ title, onUnlock, onBack }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!onUnlock(value)) {
      setError(true);
      setValue('');
    }
  }

  return (
    <div className="lock-screen">
      {onBack && (
        <button type="button" className="lock-screen-back-btn" onClick={onBack} aria-label="Назад">
          ← Назад
        </button>
      )}
      <div className="lock-screen-body">
        <div className="lock-screen-icon">🔒</div>
        <h2>{title}</h2>
        <form className="lock-screen-form" onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            className={error ? 'error' : ''}
            value={value}
            placeholder="Пароль"
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
          <button type="submit" className="btn-primary">Розблокувати</button>
        </form>
        {error && <div className="lock-screen-error">Невірний пароль</div>}
      </div>
    </div>
  );
}

// Shared "set / change / remove password" modal, used both for the
// whole-app lock and for a single document's lock.
export function SetPasswordModal({ title, isSet, onSave, onRemove, onClose }) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  function handleSave() {
    if (!pwd.trim()) {
      setError('Введіть пароль');
      return;
    }
    if (pwd !== confirm) {
      setError('Паролі не співпадають');
      return;
    }
    onSave(pwd);
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="settings-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close-btn" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="lock-disclaimer">
          ⚠️ Це проста заглушка для приватності, а не справжній захист: дані не
          шифруються і технічно доступні через інструменти розробника в
          браузері. Забудете пароль — прибрати захист можна лише повністю,
          без вводу старого пароля (сам документ при цьому не постраждає).
        </p>
        <input
          type="password"
          className="stage-add-input"
          placeholder="Новий пароль"
          value={pwd}
          onChange={(e) => {
            setPwd(e.target.value);
            setError('');
          }}
        />
        <input
          type="password"
          className="stage-add-input"
          placeholder="Повторіть пароль"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError('');
          }}
          style={{ marginTop: 8 }}
        />
        {error && <div className="lock-screen-error">{error}</div>}
        <div className="lock-modal-actions">
          {isSet && (
            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              Прибрати пароль
            </button>
          )}
          <button type="button" className="btn-primary" onClick={handleSave}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
