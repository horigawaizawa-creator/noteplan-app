import React, { useEffect, useState } from 'react';
import { AppStateProvider, useAppState } from './state/AppStateContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Workspace from './components/Workspace.jsx';
import ChecklistPanel from './components/ChecklistPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StagesModal from './components/StagesModal.jsx';
import TrashModal from './components/TrashModal.jsx';
import ReminderModal from './components/ReminderModal.jsx';
import { ToastHost, PasswordPromptScreen } from './components/UiBits.jsx';
import { computeDueItems } from './lib/docs.js';
import { deriveAccentVars, DEFAULT_ACCENT } from './lib/constants.js';

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}

function AppShell() {
  const { state, activePanel, appUnlocked, unlockApp } = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [reminderItems, setReminderItems] = useState(null);
  const [reminderShown, setReminderShown] = useState(false);
  const accentStyle = deriveAccentVars(state.ui.accentColor || DEFAULT_ACCENT);

  useEffect(() => {
    if (!state.hydrated || reminderShown) return;
    const due = computeDueItems(state.documents);
    setReminderShown(true);
    if (due.length) setReminderItems(due);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  if (!state.hydrated) {
    return <div className="app-loading">Завантаження...</div>;
  }

  if (state.ui.appLockPassword && !appUnlocked) {
    return (
      <div className="app" data-theme={state.ui.theme} style={accentStyle}>
        <PasswordPromptScreen title="🧭 Лок.Планувальник заблоковано" onUnlock={unlockApp} />
      </div>
    );
  }

  return (
    <div className="app" data-active-panel={activePanel} data-theme={state.ui.theme} style={accentStyle}>
      <Sidebar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenStages={() => setStagesOpen(true)}
        onOpenTrash={() => setTrashOpen(true)}
      />
      <Workspace />
      <ChecklistPanel />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {stagesOpen && <StagesModal onClose={() => setStagesOpen(false)} />}
      {trashOpen && <TrashModal onClose={() => setTrashOpen(false)} />}
      {reminderItems && <ReminderModal items={reminderItems} onClose={() => setReminderItems(null)} />}
      <ToastHost />
    </div>
  );
}

export { AppShell };
