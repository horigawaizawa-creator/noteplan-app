import { idbGet, idbSet, idbDelete, STORE_STATE, STORE_FILES } from './idb.js';

const STATE_KEY = 'app_state_v2';
const OLD_LOCALSTORAGE_KEY = 'noteplan_wbs_react_v1';

export async function loadState() {
  try {
    const data = await idbGet(STORE_STATE, STATE_KEY);
    if (data && typeof data === 'object' && data.documents) return data;
  } catch (e) {
    console.error('Не вдалося завантажити збережені дані:', e);
  }

  // One-time migration from the previous localStorage-based version, if present.
  try {
    const raw = localStorage.getItem(OLD_LOCALSTORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.documents) {
        await idbSet(STORE_STATE, STATE_KEY, parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Не вдалося перенести старі дані:', e);
  }
  return null;
}

export async function saveState(state) {
  try {
    await idbSet(STORE_STATE, STATE_KEY, state);
    return true;
  } catch (e) {
    console.error('Не вдалося зберегти дані:', e);
    return false;
  }
}

// ---- File attachments (stored as Blobs, separate from the main state doc) ----
export async function saveFileBlob(id, blob) {
  return idbSet(STORE_FILES, id, blob);
}
export async function getFileBlob(id) {
  return idbGet(STORE_FILES, id);
}
export async function deleteFileBlob(id) {
  return idbDelete(STORE_FILES, id);
}
