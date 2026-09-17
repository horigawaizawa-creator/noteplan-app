import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { LABEL_COLORS, DEFAULT_ACCENT } from '../lib/constants.js';
import { SetPasswordModal } from './UiBits.jsx';

export default function SettingsModal({ onClose }) {
  const { state, setAppLockPassword, lockAppNow, setAccentColor, setTheme, showToast } = useAppState();
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const appLocked = !!state.ui.appLockPassword;
  const currentAccent = state.ui.accentColor || DEFAULT_ACCENT;
  const theme = state.ui.theme || 'dark';

  function handleRemovePassword() {
    setAppLockPassword(null);
    showToast('🔓 Пароль застосунку знято');
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
          <h2>⚙️ Налаштування</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Закрити">
            ×
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">🌗</span>
            <span className="settings-card-title">Тема</span>
          </div>
          <div className="theme-switch">
            <button type="button" className={'theme-switch-btn' + (theme === 'dark' ? ' active' : '')} onClick={() => setTheme('dark')}>
              🌙 Темна
            </button>
            <button type="button" className={'theme-switch-btn' + (theme === 'light' ? ' active' : '')} onClick={() => setTheme('light')}>
              ☀️ Світла
            </button>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">🎨</span>
            <span className="settings-card-title">Колір акценту</span>
          </div>
          <p className="settings-card-desc">Змінює колір кнопок, виділень та значка WBS по всьому застосунку.</p>
          <div className="stage-color-swatches accent-swatches">
            {LABEL_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={'swatch-mini' + (currentAccent === c.hex ? ' selected' : '')}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => setAccentColor(c.hex)}
              />
            ))}
            <button
              type="button"
              className={'accent-reset-btn' + (currentAccent === DEFAULT_ACCENT ? ' selected' : '')}
              title="Типовий колір за замовчуванням"
              onClick={() => setAccentColor(null)}
            >
              <span className="swatch-mini" style={{ background: DEFAULT_ACCENT }} />
              Типовий
            </button>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">🔒</span>
            <span className="settings-card-title">Захист застосунку</span>
          </div>
          <p className="settings-card-desc">
            {appLocked
              ? 'Пароль потрібно вводити при кожному новому відкритті застосунку.'
              : 'Без пароля застосунок відкривається одразу, без запиту.'}{' '}
            Це проста заглушка для приватності, не справжнє шифрування.
          </p>
          <div className="settings-actions-row">
            <button type="button" className="btn-transform-subtle" onClick={() => setPwdModalOpen(true)}>
              {appLocked ? '🔒 Змінити пароль' : '🔒 Встановити пароль'}
            </button>
            {appLocked && (
              <>
                <button type="button" className="btn-danger-outline" onClick={handleRemovePassword}>
                  🔓 Зняти пароль
                </button>
                <button
                  type="button"
                  className="wbs-icon-btn lock-now-btn"
                  title="Заблокувати застосунок зараз"
                  aria-label="Заблокувати застосунок зараз"
                  onClick={lockAppNow}
                >
                  🔐
                </button>
              </>
            )}
          </div>
        </div>

        {pwdModalOpen && (
          <SetPasswordModal
            title={appLocked ? 'Змінити пароль застосунку' : 'Встановити пароль застосунку'}
            isSet={appLocked}
            onSave={(pwd) => setAppLockPassword(pwd)}
            onRemove={() => setAppLockPassword(null)}
            onClose={() => setPwdModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
